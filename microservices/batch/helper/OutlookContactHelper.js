require('isomorphic-fetch');
const { loggerInfo, loggerError } = require('../config/logger');
const { formatContactsFromOutlook, formatContactFromOutlook } = require('./ContactHelper')

const createContact = async (client, outlookContact) => {
  try {
    const apiLink = '/me/contacts';

    const createdContact = await client.api(apiLink).post(outlookContact);
    loggerInfo('createdContact', createdContact)
    return createdContact && formatContactFromOutlook(createdContact)
  } catch (e) {
    loggerError('error createContact', outlookContact, { e })
    return null
  }
}

const getOutlookContactsFirstTime = async ({
  client,
  nextLink,
  projectId,
}) => {
  try {
    let apiLink;
    const startTime = Date.now()
    const limit = 500;

    if (nextLink)
      apiLink = nextLink
    else
      apiLink = `/me/contacts/delta`

    loggerInfo({ apiLink })
    loggerInfo('...fetching...')

    let results;

    if (nextLink) results = await client.api(apiLink).get();
    else
      results = await client.api(apiLink)
        .header('Prefer', `odata.maxpagesize=${limit}`)
        .get();

    loggerInfo({ resultsValues: results.value, results: JSON.stringify(results) })

    let resultsValue = []

    let totalCount, newNextLink, deltaLink;

    if (results) {
      totalCount = results['@odata.count']
      resultsValue = results.value || []
      newNextLink = results['@odata.nextLink']
      deltaLink = results['@odata.deltaLink']
    }

    const contacts = formatContactsFromOutlook(resultsValue, projectId)

    loggerInfo({ resultsValueLength: resultsValue.length, totalCount })
    loggerInfo({ nextLink, newNextLink, deltaLink, contactsLength: contacts.length })
    // loggerInfo({ time: (Date.now() - startTime) / 1000 + 's' })

    return {
      newNextLink,
      deltaLink,
      outlookContactsResult: contacts,
    }
  } catch (e) {
    loggerError('init err', { e })
    return e
    // return {
    //   newNextLink: nextLink,
    //   outlookEventsResult: []
    // }
  }
}

const getOutlookContactsChanges = async ({
  client,
  apiLink,
  projectId,
}) => {
  try {
    const startTime = Date.now()

    loggerInfo({ apiLink })

    const results = await client.api(apiLink).get();
    loggerInfo({ results })
    const resultsValues = results && results.value || [];
    loggerInfo({ resultsValues })

    const outlookContactIdsDeleted = resultsValues
      .filter(contact => contact && !!contact['@removed'])
      .map(c => c.id)

    loggerInfo({ resultsValues })
    const notRemovedContacts = resultsValues.filter(contact => contact && !contact['@removed'])
    const outlookContactsUpdated = formatContactsFromOutlook(notRemovedContacts, projectId)

    loggerInfo({
      outlookContactIdsDeleted,
      outlookContactsUpdated,
      resultsValuesLength: resultsValues.length
    })

    let totalCount, newNextLink, newDeltaLink;

    if (results) {
      totalCount = results['@odata.count']
      newNextLink = results['@odata.nextLink']
      newDeltaLink = results['@odata.deltaLink']
    }

    loggerInfo({ newDeltaLink, newNextLink, totalCount })
    loggerInfo({ time: (Date.now() - startTime) / 1000 + 's' })

    return {
      newNextLink,
      newDeltaLink,
      outlookContactIdsDeleted,
      outlookContactsUpdated,
    }
  } catch (e) {
    loggerError('init err', { e })
    return e
    // return {
    //   newNextLink: nextLink,
    //   outlookEventsResult: []
    // }
  }
}

const updateOutlookContact = async (client, id, contact) => {
  try {
    let updatedContact = await client.api(`/me/contacts/${id}`).update(contact)
    return formatContactFromOutlook(updatedContact)
  } catch (e) {
    loggerError('updateOutlookContact Error:', { e })
    return null
  }
}

const deleteOutlookContact = async (client, id) => {
  try {
    await client.api(`/me/contacts/${id}`).delete();
    return true
  } catch (e) {
    return false
  }
}

module.exports = {
  createContact,
  updateOutlookContact,
  deleteOutlookContact,
  getOutlookContactsFirstTime,
  getOutlookContactsChanges,
};
