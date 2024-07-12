const { getClientWithUpdateToken } = require('../../../helper/AuthHelper');
const { createContact, updateOutlookContact, deleteOutlookContact } = require('../../../helper/OutlookContactHelper');
const mongoose = require('mongoose');
const moment = require('moment');
const { OutlookSyncStatusTypes } = require('../../../constants/outlook');
const { getUpdLogContactsIds, formatContactToOutlook, getContactsOutlookIds, getOutlookContact } = require('../../../helper/ContactHelper');
const { isContactModified, getLatestUpdatedContact } = require('../../../helper/SyncHelper');
const { ContactLogActionTypes } = require('../../../constants/contact');
const { syncContactsInCalUpdLogs } = require('../contactUpdateLogs');
const { loggerInfo, loggerError } = require('../../../config/logger');


// update events in db or outlook
const updateContactsInDbAndOutlook = async ({
  outlookContactsUpdated,
  syncedContactsFound,
  client,
  models,
  projectId,
  outlookContactSyncId,
}) => {
  const contactsToUpdateInOutlook = []

  const syncedContactsBulkUpdates = []
  const updatedContactsIds = []
  const newContactsInOutlook = []

  for (const outlookContact of outlookContactsUpdated) {

    const dbContact = getOutlookContact(syncedContactsFound, outlookContact.outlookId);
    loggerInfo({ syncedContact: dbContact, outlookContact })

    if (dbContact) {
      // check if there are differences
      const isModified = isContactModified(dbContact, outlookContact)
      if (isModified) {
        // test if what contact has the most recent update 
        const latestUpdatedContact = getLatestUpdatedContact(dbContact, outlookContact)
        loggerInfo('latestUpdatedContact', latestUpdatedContact)
        if (latestUpdatedContact === 'contact') {

          // update contact in (outlook)
          const formattedContact = formatContactToOutlook(dbContact)
          loggerInfo('contact to update in outlook: ', formattedContact)

          if (formattedContact) {
            const updatedContact = await updateOutlookContact(
              client,
              dbContact.outlookId,
              formattedContact
            )
            if (updatedContact) {
              updatedContactsIds.push(dbContact._id)
              contactsToUpdateInOutlook.push(updatedContact)
            }
            loggerInfo('updatedContact', updatedContact)
          }
        }
        else if (latestUpdatedContact === 'outlookContact') {
          // update contact in (db)
          loggerInfo('outlookContact to update in db:', outlookContact)

          syncedContactsBulkUpdates.push({
            updateOne: {
              filter: { _id: mongoose.Types.ObjectId(dbContact._id) },
              update: {
                name: outlookContact.name,
                contact_information: outlookContact.contact_information,
                home_address: outlookContact.home_address,
                business_address: outlookContact.business_address,
                other_address: outlookContact.other_address,
                work: outlookContact.work,
                other: outlookContact.other,
                notes: outlookContact.notes,
                updatedAt: new Date(),
              }
            }
          })
        }
      }
    } else {
      const createNewContact = await models.Contact.create({
        name: outlookContact.name,
        contact_information: outlookContact.contact_information,
        home_address: outlookContact.home_address,
        business_address: outlookContact.business_address,
        other_address: outlookContact.other_address,
        work: outlookContact.work,
        other: outlookContact.other,
        notes: outlookContact.notes,
        projectId: outlookContact.projectId,
        createdAt: outlookContact.createdAt,
        parentFolderId: outlookContact.parentFolderId,
        lastModifiedDateTime: outlookContact.lastModifiedDateTime,
        fromOutlook: outlookContact.fromOutlook,
        outlookId: outlookContact.outlookId
      });
      await syncContactsInCalUpdLogs({
        _projectId: projectId,
        _outlookContactSyncId: outlookContactSyncId,
        _contactIds: createNewContact._id,
        _action: ContactLogActionTypes.CREATE
      })
    }
  }

  loggerInfo({ syncedContactsBulkOps: JSON.stringify(syncedContactsBulkUpdates) })
  await models.Contact.bulkWrite(syncedContactsBulkUpdates)
  await syncContactsInCalUpdLogs({
    _projectId: projectId,
    _outlookContactSyncId: outlookContactSyncId,
    _contactIds: updatedContactsIds,
    _action: ContactLogActionTypes.UPDATE
  })
  return {
    contactsToUpdateInOutlook,
  }
}

// update events in Outlook
const updateContactInOutlook = async ({
  models,
  projectId,
  client,
  outlookContactsUpdatedIds,
  updatedDbContactIds
}) => {
  const updatedContactIds = []
  const syncedContactsToUpdateFound = await models.Contact.find({
    _id: { $in: updatedDbContactIds || [] },
    projectId,
    outlookId: { $not: { $eq: null }, },
    outlookId: { $nin: outlookContactsUpdatedIds },
  });

  // UPDATE in outlook  
  for (const syncedContact of syncedContactsToUpdateFound) {
    const formattedSyncedContact = formatContactToOutlook(syncedContact)
    loggerInfo('contact to Update formattedSyncedContact: ', JSON.stringify(formattedSyncedContact))

    if (formattedSyncedContact) {
      updatedContactIds.push(syncedContact._id)
      await updateOutlookContact(
        client,
        syncedContact.outlookId,
        formattedSyncedContact
      )
    }
  }

  await syncContactsInCalUpdLogs({
    _projectId: projectId,
    _contactIds: updatedContactIds,
    _action: ContactLogActionTypes.UPDATE
  })

  loggerInfo({ syncedContactsToUpdateFound })

}

// delete contacts in outlook 
const deleteContactsInOutlook = async ({
  models,
  projectId,
  outlookContactsUpdatedIds,
  outlookContactsUpdated,
  client,
  updatedDbContactIds,
}) => {
  // find contacts(that were synced and that are not found in outlook/doesn't have outlookId)
  // to delete in db
  const syncedContacts = await models.Contact.find({
    projectId,
    deletedAt: { $not: { $eq: null } },
    outlookId: { $not: { $eq: null } },
    trash: 1,
    _id: { $in: updatedDbContactIds || [] }
  })

  const contactsIdsToDelete = []

  loggerInfo({ syncedContacts })
  // delete contacts in outlook
  for (const contact of syncedContacts) {

    let shouldDelete = true

    if (outlookContactsUpdatedIds.includes(contact.outlookId)) {

      const contactFound = outlookContactsUpdated.find(e => e.outlookId === contact.outlookId)

      if (contactFound && contactFound.lastModifiedDateTime) {
        shouldDelete = moment(contactFound.lastModifiedDateTime).isBefore(contact.deletedAt)
      }

    }

    if (shouldDelete) {
      contactsIdsToDelete.push(contact._id)
      await deleteOutlookContact(client, contact.outlookId)
    }
  }

  await models.Contact.updateMany(
    { projectId, _id: { $in: contactsIdsToDelete } },
    { outlookId: null }
  )
  await syncContactsInCalUpdLogs({
    _projectId: projectId,
    _action: ContactLogActionTypes.DELETE,
    _contactIds: contactsIdsToDelete
  })
}

const deleteOutlookContactsInDb = async ({
  models,
  projectId,
  outlookContactSyncFound,
}) => {
  const outlookContactIdsDeleted = outlookContactSyncFound.outlookContactIdsDeleted || []


  if (outlookContactIdsDeleted.length > 0) {
    const deletedContact = await models.Contact.updateMany(
      {
        projectId: mongoose.Types.ObjectId(projectId),
        outlookId: { $in: outlookContactIdsDeleted },
      },
      { trash: 1, deletedAt: new Date() }
    );

    loggerInfo({ deletedContact })
  }
  loggerInfo('delete-debug', { outlookContactIdsDeleted })
}

const createContacts = async ({
  projectId,
  models,
  client,
}) => {

  // create contacts in outlook
  loggerInfo('>>> creating contacts from db to outlook...')
  const contactFilter = {
    projectId,
    outlookId: null,
    deletedAt: null,
  }
  const contactsCount = await models.Contact.count(contactFilter)
  const contactLimit = 500;
  let createContactCount = 0;
  let createContactPage = 0;

  while (createContactCount < contactsCount) {
    const createContactsBulkOps = []
    const contactsFound = await models.Contact.find(contactFilter)
      .skip(createContactPage * contactLimit)
      .limit(contactLimit)

    for (const contact of contactsFound) {
      createContactCount += 1
      loggerInfo({ contact })

      const formattedContact = formatContactToOutlook(contact);
      if (formattedContact) {
        const createdContact = await createContact(
          client,
          formattedContact,
        );
        // loggerInfo({ createdContact })
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
    await models.Contact.bulkWrite(createContactsBulkOps)
    createContactPage += 1;
  }
}

// -----------------------------
// SYNC CONTACT UPDATE MUTATION
// -----------------------------
const syncContactUpdate = async (_, { projectId, outlookContactSyncId }, { models }) => {
  const startTime = Date.now()
  try {
    loggerInfo('--------------- Sync Contact Update -----------------------')
    // update outlookcontactsync status and timestamp
    await models.OutlookContactSync.updateOne({ _id: outlookContactSyncId }, {
      status: OutlookSyncStatusTypes.SYNCING,
      syncStartAt: new Date()
    })

    // find project
    const projectFound = await models.Project.findById(projectId)

    // define variables
    const {
      accessToken,
      refreshToken,
    } = projectFound && projectFound.outlook || {}
    const client = await getClientWithUpdateToken({ accessToken, refreshToken, projectId, models })

    const outlookContactSyncFound = await models.OutlookContactSync.findById(outlookContactSyncId)

    const outlookContactIdsDeleted = await outlookContactSyncFound.outlookContactIdsDeleted || []
    const outlookContactsUpdated = await (outlookContactSyncFound.outlookContactsUpdated || [])
      .filter(sc => !outlookContactIdsDeleted.includes(sc.outlookId))

    const outlookContactsUpdatedIds = getContactsOutlookIds(outlookContactsUpdated)
    const syncedContactsFound = await models.Contact.find({
      projectId,
      outlookId: { $in: outlookContactsUpdatedIds },
    })

    const updatedDbContactIds = await getUpdLogContactsIds({
      projectId,
      outlookContactSyncId,
      action: ContactLogActionTypes.UPDATE
    })

    loggerInfo('updatedDbContactIds', {
      updatedDbContactIds
    })

    loggerInfo('contact lists', {
      syncedContactsFoundL: syncedContactsFound.length,
      outlookContactIdsDeleted,
      outlookContactsUpdated,
    })

    // -------------------------
    // ----- UPDATE EVENT ------
    // -------------------------
    const { contactsToUpdateInOutlook } = await updateContactsInDbAndOutlook({
      outlookContactsUpdated,
      syncedContactsFound,
      client,
      models,
      projectId,
      outlookContactSyncId,
    })

    await updateContactInOutlook({
      models,
      projectId,
      client,
      outlookContactsUpdatedIds,
      updatedDbContactIds,
    })

    // ------------------------------
    // ------- DELETE CONTACTS --------
    // ------------------------------
    
    // DELETE in db
    await deleteOutlookContactsInDb({
      models,
      projectId,
      outlookContactSyncFound
    })

    await deleteContactsInOutlook({
      models,
      projectId,
      outlookContactsUpdatedIds,
      outlookContactsUpdated,
      client,
      updatedDbContactIds,
    })

    // ----------------------------------
    // -------- CREATING CONTACTS ---------
    // ----------------------------------
    await createContacts({
      projectId,
      models,
      client,
    })

    // update outlook contact sync
    await models.OutlookContactSync.updateOne(
      { _id: outlookContactSyncId },
      {
        started: false,
        finished: true,
        status: OutlookSyncStatusTypes.SUCCESS,
        syncEndAt: new Date(),
        failedAt: null,
        newDeltaLink: null,
        ...outlookContactSyncFound.newDeltaLink && { deltaLink: outlookContactSyncFound.newDeltaLink }
      }
    )

    const endTime = Date.now()

    loggerInfo(' ----- done sync --------')
    loggerInfo('time', (endTime - startTime) / 1000 + ' seconds')
    return outlookContactSyncId

  } catch (e) {
    loggerError('ERROR: syncContactUpdate, ', { e })
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
  syncContactUpdate
}
