const { getClientWithUpdateToken } = require('../../../helper/AuthHelper');
const { createContact, } = require('../../../helper/OutlookContactHelper');
const mongoose = require('mongoose');
const { OutlookSyncStatusTypes } = require('../../../constants/outlook');
const { formatContactToOutlook, } = require('../../../helper/ContactHelper');
const { Contact } = require('../../../models');
const { loggerInfo, loggerError } = require('../../../config/logger');

const createContactsInOutlook = async ({
  client,
  projectId
}) => {
  // ----- create contacts in outlook ---
  loggerInfo('>>> creating contacts from db to outlook...')
  const contactFilter = {
    projectId,
    outlookId: null,
    deletedAt: null,
  }
  const contactsCount = await Contact.count(contactFilter)
  const contactLimit = 500;
  let createContactCount = 0;
  let createContactPage = 0;

  while (createContactCount < contactsCount) {
    const createContactsBulkOps = []
    const contactsFound = await Contact.find(contactFilter)
      .skip(createContactPage * contactLimit)
      .limit(contactLimit)

    for (const contact of contactsFound) {
      createContactCount += 1
      const formattedContact = formatContactToOutlook(contact);
      if (formattedContact) {
        const createdContact = await createContact(
          client,
          formattedContact
        );

        if (createdContact) {
          createContactsBulkOps.push({
            updateOne: {
              filter: { _id: mongoose.Types.ObjectId(contact.id) },
              update: { outlookId: createdContact.outlookId, updatedAt: new Date() }
            }
          })
        }
      }
    }
    await Contact.bulkWrite(createContactsBulkOps);
    createContactPage += 1;
  }
}

// ------------------------------------
// ------- FIRST CONTACT SYNC --------
// ------------------------------------
const firstContactSync = async (_, { projectId, outlookContactSyncId }, { models }) => {
  const startTime = Date.now()
  try {
    loggerInfo('--------------- First Contact Sync -----------------------')
    // update outlookcontactsync status and timestamp
    await models.OutlookContactSync.updateOne({ _id: outlookContactSyncId }, {
      status: OutlookSyncStatusTypes.SYNCING,
      syncStartAt: new Date()
    })
    // find project
    const projectFound = await models.Project.findById(projectId)
    const { accessToken, refreshToken } = projectFound && projectFound.outlook || {}
    // define variables
    const client = await getClientWithUpdateToken({ accessToken, refreshToken, models, projectId })

    // ----- CREATE contacts in outlook -----
    await createContactsInOutlook({
      client,
      projectId
    })

    // --------------------------------------------
    // ----- CREATE CONTACTS IN (DB) FROM OUTLOOK ----- 
    // --------------------------------------------
    const outlookContactSyncFound = await models.OutlookContactSync.findById(outlookContactSyncId)
    loggerInfo('found', outlookContactSyncFound)
    const outlookContactsResult = await outlookContactSyncFound.contacts

    loggerInfo('>>> creating contacts from outlook to db...')

    const outlookContactsToSave = [];
    const saveContactsIds = [];
    const duplicates = [];

    for (const contact of outlookContactsResult) {
      if (!saveContactsIds.includes(contact.outlookId)) {
        saveContactsIds.push(contact.outlookId)

        if (contact !== null) outlookContactsToSave.push(contact)
      } else {
        duplicates.push(contact)
      }
    }

    loggerInfo({ duplicatesLength: duplicates.length })
    // -----------------------------------
    // --- create outlook events to (DB) ---
    await models.Contact.insertMany(outlookContactsToSave)

    // const fetchNewDeltaLink = await client.api('/me/contacts/delta').get();
    // loggerInfo({ fetchNewDeltaLink: fetchNewDeltaLink['@odata.deltaLink'] })
    // update outlooksync to finish sync
    await models.OutlookContactSync.updateOne(
      { _id: outlookContactSyncId },
      {
        started: false,
        finished: true,
        status: OutlookSyncStatusTypes.SUCCESS,
        syncEndAt: new Date(),
        failedAt: null,
        isFirstSync: false,
        newDeltaLink: null,
        deltaLink: outlookContactSyncFound.newDeltaLink,
      }
    )

    loggerInfo('time', (Date.now() - startTime) / 1000 + ' seconds')

    return outlookContactSyncId

  } catch (e) {
    loggerError('ERROR: firstSyncContact, ', { e })
    await models.OutlookContactSync.updateOne(
      { _id: outlookContactSyncId },
      {
        started: false,
        finished: true,
        status: OutlookSyncStatusTypes.FAILED_SYNCING,
        failedAt: new Date(),
      }
    )
    return e
  }
};

module.exports = {
  firstContactSync,
}
