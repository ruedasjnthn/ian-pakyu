require('isomorphic-fetch');
const mongoose = require('mongoose')
const { ContactUpdateLog } = require('../models');
const { loggerInfo, loggerError } = require('../config/logger');

const formatContactFromOutlook = (contact, projectId) => {
  const { createdDateTime, homePhones = [], businessPhones = [] } = contact;
  return {
    projectId: mongoose.Types.ObjectId(projectId),
    name: {
      first_name: contact.givenName || ' ',
      last_name: contact.surname || ' ',
      middle_initial: contact.middleName !== null ? contact.middleName.charAt(0).toUpperCase() : contact.middleName,
      nick_name: contact.nickName,
      middle_name: contact.middleName,
      title: contact.title,
      yowi_first_name: contact.yomiGivenName,
      yowi_last_name: contact.yomiSurname,
    },
    contact_information: {
      email: contact.emailAddresses.length ? contact.emailAddresses[0].address : null,
      home_number: homePhones[0],
      mobile_number: contact.mobilePhone,
      business_number: businessPhones[0],
    },
    home_address: {
      home_address_street: contact.homeAddress.street,
      home_address_city: contact.homeAddress.city,
      home_address_state: contact.homeAddress.state,
      home_address_zip: contact.homeAddress.postalCode,
      home_address_country: contact.homeAddress.countryOrRegion,
    },
    business_address: {
      business_address_street: contact.businessAddress.street,
      business_address_city: contact.businessAddress.city,
      business_address_state: contact.businessAddress.state,
      business_address_zip: contact.businessAddress.postalCode,
      business_address_country: contact.businessAddress.countryOrRegion,
    },
    other_address: {
      other_address_street: contact.otherAddress.street,
      other_address_city: contact.otherAddress.city,
      other_address_state: contact.otherAddress.state,
      other_address_zip: contact.otherAddress.postalCode,
      other_address_country: contact.otherAddress.countryOrRegion,
    },
    work: {
      company: contact.companyName,
      work_job_title: contact.jobTitle,
      yowi_company: contact.yomiCompanyName,
    },
    other: {
      significant_other: contact.spouseName,
      birth_day: contact.birthday,
    },
    notes: {
      notes: contact.personalNotes,
    },
    createdAt: new Date(createdDateTime),
    parentFolderId: contact.parentFolderId,
    lastModifiedDateTime: contact.lastModifiedDateTime,
    fromOutlook: true,
    outlookId: contact.id,
  }
}
const formatContactsFromOutlook = (contacts, projectId) => contacts.map(contactItem => formatContactFromOutlook(contactItem, projectId))

const getUserContacts = async (client, projectId) => {
  try {
    const results = await client.api('/me/contacts')
      .get();

    return formatContactsFromOutlook(results.value, projectId);
    // return results.value;
  } catch (error) {
    loggerError({ error });
    return error
  }
}

const getOutlookContactIdsToDeleteInOutlookContactFromAktenplatz = async (models, projectId) => {
  const contactsToDelete = await models.Contact.find({
    projectId,
    $or: [{ fromOutlook: false }, { fromOutlook: null }],
    outlookId: { $not: { $eq: null } }
  })

  const outlookContactsIds = [
    ...contactsToDelete.map(e => e.outlookId),
  ]
  loggerInfo('contactstodelete', {
    outlookContactsIds
  })

  return outlookContactsIds
}

// format contact from the DB to match the structure
// of a contact from outlook
const formatContactToOutlook = (contact) => {
  try {
    const { home_number, business_number } = contact.contact_information || {}
    return {
      ...contact.outlookId && { id: contact.id, },
      ...contact.name && {
        givenName: contact.name.first_name,
        surname: contact.name.last_name,
        middleName: contact.name.middle_name,
        nickName: contact.name.nick_name,
        yomiGivenName: contact.name.yowi_first_name,
        yomiSurname: contact.name.yowi_last_name,
        title: contact.name.title,
      },
      ...contact.contact_information && {
        mobilePhone: contact.contact_information.mobile_number,
        businessPhones: business_number ? [business_number] : [],
        homePhones: home_number ? [home_number] : [],
      },
      ...contact.contact_information.email && {
        emailAddresses: [{ address: contact.contact_information.email }]
      },
      ...contact.other && {
        birthday: contact.other.birth_day,
        spouseName: contact.other.significant_other,
      },
      ...contact.home_address && {
        homeAddress: {
          city: contact.home_address.home_address_city,
          countryOrRegion: contact.home_address.home_address_country,
          postalCode: contact.home_address.home_address_zip,
          state: contact.home_address.home_address_state,
          street: contact.home_address.home_address_street,
        }
      },
      ...contact.business_address && {
        businessAddress: {
          city: contact.business_address.business_address_city,
          countryOrRegion: contact.business_address.business_address_country,
          postalCode: contact.business_address.business_address_zip,
          state: contact.business_address.business_address_state,
          street: contact.business_address.business_address_street,
        }
      },
      ...contact.other_address && {
        otherAddress: {
          city: contact.other_address.other_address_city,
          countryOrRegion: contact.other_address.other_address_country,
          postalCode: contact.other_address.other_address_zip,
          state: contact.other_address.other_address_state,
          street: contact.other_address.other_address_street,
        }
      },
      ...contact.work && {
        companyName: contact.work.company,
        jobTitle: contact.work.work_job_title,
        yomiCompanyName: contact.work.yowi_company,
      },
      ...contact.notes && {
        personalNotes: contact.notes.notes
      },
      ...contact.parentFolderId && {
        parentFolderId: contact.parentFolderId,
      }
    }
  }
  catch (e) {
    loggerError('err', { e })
    return null
  }
}

const formatContactsToOutlook = (contacts = []) =>
  contacts.map(contact => formatContactToOutlook(contact))
    .filter(contact => Boolean(contact));

const getContactsOutlookIds = (contacts) => contacts.map(contact => contact.outlookId)

const getUpdLogContactsIds = async ({
  projectId,
  outlookContactSyncId,
  action,
}) => {
  try {
    const logsFound = await ContactUpdateLog.find({
      projectId,
      outlookContactSyncId,
      action,
      synced: false,
    })
    loggerInfo('logsFound', logsFound)
    return logsFound.map(l => l.contactId)

  } catch (e) {
    loggerError('ERROR: getContUpdLogEventsIds, ', { e })
    return e
  }
}

const getOutlookContact = (outlookContacts, outlookId) => outlookContacts.find(contact => contact.outlookId === outlookId)

module.exports = {
  formatContactFromOutlook,
  formatContactsFromOutlook,
  getUserContacts,
  getOutlookContactIdsToDeleteInOutlookContactFromAktenplatz,
  formatContactToOutlook,
  formatContactsToOutlook,
  getContactsOutlookIds,
  getUpdLogContactsIds,
  getOutlookContact,
}