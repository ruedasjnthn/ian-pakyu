const {
  getAuthUrl,
  getClientWithUpdateToken
} = require('../../../helper/AuthHelper');
const {
  deleteOutlookEvent, batchDeleteOutlookEvent, deleteOutlookEvents20PerBatch,
} = require('../../../helper/OutlookEventHelper');
const {
  getOutlookEventsIdsToDeleteInOutlookFromAktenplatz,
} = require('../../../helper/EventHelper');
const { ApolloError } = require('apollo-server-express');
const {
  deleteOutlookContact,
} = require('../../../helper/OutlookContactHelper');
const {
  getOutlookContactIdsToDeleteInOutlookContactFromAktenplatz,
} = require('../../../helper/ContactHelper');
const { loggerInfo, loggerError } = require('../../../config/logger');
const { OutlookSyncStatusTypes, OutlookEventTypes } = require('../../../constants/outlook');
const {
  deleteOutlookMailSubscription,
} = require('../../../helper/OutlookMailHelper');
const mongoose = require('mongoose');
const { OutlookCalendarSyncStatus } = require('../../../constants/outlook-calendar');
const { isSameId } = require('../../../helper/StringHelper');


const enableOutlookSync = async (_, { projectId }, { models }) => {
  try {
    const authUrl = await getAuthUrl()
    if (!authUrl) throw new ApolloError('auth_url_not_found')
    await models.Project.updateOne({ _id: projectId }, {
      syncEnabled: true,
      timeZone: 'Europe/Berlin',
      outlook: {}
    })
    // TODO: fix this, how about the seriesMasterEvents areplace seriesMasterIds of the occurence of events
    await models.Event.updateMany({ projectId }, { outlookId: null })
    await models.Issue.updateMany(
      { projectId },
      { $set: { "issueCustomFields.$[elem].outlookId": null } },
      { arrayFilters: [{ "elem.outlookId": { $ne: null } }] }
    )
    return authUrl
  } catch (e) {
    return e
  }
}

const disableOutlookSync = async (_, { projectId }, { models }) => {
  try {
    const projectFound = await models.Project.findById(projectId, 'outlook eventCategories');
    if (!projectFound) throw new ApolloError('no_project_found')

    const ongoingSync = await models.OutlookSync.findOne({
      projectId,
      status: {
        $in: [
          OutlookSyncStatusTypes.INITIALIZING,
          OutlookSyncStatusTypes.PENDING,
          OutlookSyncStatusTypes.READY_TO_INITIALIZE,
          OutlookSyncStatusTypes.READY_TO_SYNC,
          OutlookSyncStatusTypes.SYNCING,
          OutlookSyncStatusTypes.DISABLING,
          OutlookSyncStatusTypes.AUTHORIZING,
        ]
      }
    }, 'id status')

    if (ongoingSync !== null) {
      if (ongoingSync.status === OutlookSyncStatusTypes.DISABLING)
        throw new ApolloError('sync_is_disabling')
      if (ongoingSync.status === OutlookSyncStatusTypes.AUTHORIZING)
        throw new ApolloError('sync_is_authorizing')
      else throw new ApolloError('sync_is_still_running')
    }

    await models.OutlookSync.updateOne(
      { projectId, },
      { status: OutlookCalendarSyncStatus.DISABLING }
    )

    const { accessToken, refreshToken, accountId } = projectFound.outlook || {}
    const projectEventCategories = projectFound.eventCategories || []
    const client = await getClientWithUpdateToken({ projectId, accessToken, models, refreshToken })

    if (client === null) throw new ApolloError('expired_token_re_authorize_outlook')

    await convertCategoriesToLocal({ projectId, models, projectEventCategories })

    if (refreshToken || accessToken) {
      const outlookIdsToDelete = await getOutlookEventsIdsToDeleteInOutlookFromAktenplatz(
        models,
        projectId
      )

      loggerInfo({ outlookIdsToDelete })

      await deleteOutlookEvents20PerBatch(client, outlookIdsToDelete)

      //Contacts
      const outlookContactIdsToDelete = await getOutlookContactIdsToDeleteInOutlookContactFromAktenplatz(
        models,
        projectId
      )
      loggerInfo({ outlookContactIdsToDelete })

      for (const outlookId of outlookContactIdsToDelete) {
        await deleteOutlookContact(
          client,
          outlookId
        )
      }
    }

    await models.Project.updateOne(
      { _id: projectId },
      {
        syncEnabled: false,
        contactSyncEnabled: false,
        outlook: null,
        mailSubscribed: false,
      }
    )

    // make fromOutlook:true events to false and change seriesMasterIds 
    const masterEventsFound = await models.Event.find(
      { projectId, fromOutlook: true, type: OutlookEventTypes.SERIES_MASTER },
      'id outlookId'
    )

    const eventUpdateOps = []

    for (const me of masterEventsFound) {
      eventUpdateOps.push({
        updateMany: {
          filter: { seriesMasterId: me.outlookId },
          update: { seriesMasterId: me.id, fromOutlook: false }
        },
      })
    }

    // make fromOutlook:true events to false of the remianing events
    await models.Event.updateMany(
      { projectId, fromOutlook: true },
      { fromOutlook: false }
    )

    loggerInfo('eventUpdateOps', {
      eventUpdateOps: JSON.stringify(eventUpdateOps)
    })


    await models.Event.bulkWrite(eventUpdateOps)


    await models.Event.updateMany({ projectId }, { outlookId: null })
    await models.Issue.updateMany(
      { projectId },
      { $set: { "issueCustomFields.$[elem].outlookId": null } },
      { arrayFilters: [{ "elem.outlookId": { $ne: null } }] }
    )
    await models.OutlookSync.deleteMany({ projectId })
    await models.CalendarUpdateLog.deleteMany({ projectId })

    //Contacts
    await models.Contact.deleteMany({ projectId, fromOutlook: true })
    await models.Contact.updateMany({ projectId }, { outlookId: null, deletedAt: null, trash: 0 })
    await models.OutlookContactSync.deleteMany({ projectId })
    await models.ContactUpdateLog.deleteMany({ projectId })

    //Mails & subscription
    await models.OutlookMail.deleteMany({ projectId, fromOutlook: true })
    await deleteOutlookMailSubscription(client, projectId, models)

    await models.OutlookMail.deleteMany({ sourceProjectId: projectId, fromOutlook: true })
    await models.OutlookMailRule.deleteMany({ projectId })

    return 'success_disabled'

  } catch (e) {
    loggerError('disableOutlookSync ERROR', { e })
    await models.OutlookSync.updateOne(
      { projectId, },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_DISABLE,
        failedAt: new Date(),
        errMessage: e.message
      }
    )
    return e
  }
}

const disconnectOutlookSync = async (_, { projectId }, { models }) => {
  try {
    loggerInfo('disconnectOutlookSync')
    const projectFound = await models.Project.findById(projectId, 'outlook eventCategories');
    if (!projectFound) throw new ApolloError('no_project_found')


    await models.Project.updateOne(
      { _id: projectId },
      {
        syncEnabled: false,
        contactSyncEnabled: false,
        outlook: null,
        mailSubscribed: false,
      }
    )

    const projectEventCategories = projectFound.eventCategories || []

    await convertCategoriesToLocal({ projectId, models, projectEventCategories })

    // make fromOutlook:true events to false and change seriesMasterIds 
    const masterEventsFound = await models.Event.find(
      { projectId, fromOutlook: true, type: OutlookEventTypes.SERIES_MASTER },
      'id outlookId'
    )

    const eventUpdateOps = []

    for (const me of masterEventsFound) {
      eventUpdateOps.push({
        updateMany: {
          filter: { seriesMasterId: me.outlookId },
          update: { seriesMasterId: me.id, fromOutlook: false }
        },
      })
    }

    // make fromOutlook:true events to false of the remianing events
    await models.Event.updateMany(
      { projectId, fromOutlook: true },
      { fromOutlook: false }
    )

    loggerInfo('eventUpdateOps', {
      eventUpdateOps: JSON.stringify(eventUpdateOps)
    })

    await models.Event.bulkWrite(eventUpdateOps)
    await models.Event.updateMany({ projectId }, { outlookId: null })

    await models.Issue.updateMany(
      { projectId },
      { $set: { "issueCustomFields.$[elem].outlookId": null } },
      { arrayFilters: [{ "elem.outlookId": { $ne: null } }] }
    )

    await models.OutlookSync.deleteMany({ projectId })
    await models.CalendarUpdateLog.deleteMany({ projectId })

    //Contacts
    // await models.Contact.updateMany({ projectId, fromOutlook: true } , {})
    await models.Contact.updateMany(
      { projectId },
      { fromOutlook: false, outlookId: null, deletedAt: null, trash: 0 }
    )
    await models.OutlookContactSync.deleteMany({ projectId })
    await models.ContactUpdateLog.deleteMany({ projectId })

    //Mails & subscription
    await models.OutlookMail.deleteMany({ projectId, fromOutlook: true })
    // await deleteOutlookMailSubscription(client, projectId, models)

    await models.OutlookMail.deleteMany({ sourceProjectId: projectId, fromOutlook: true })
    await models.OutlookMailRule.deleteMany({ projectId })

    return 'success_disabled'
  } catch (err) {
    loggerError('disconnectOutlookSync', { errmessage: err.message })
    return err
  }
}

const convertCategoriesToLocal = async ({ projectId, models, accountId, projectEventCategories }) => {
  try {

    const customFieldsWithCatgoriesFound = await models.CustomField.find({
      projectId,
      categoryId: { $ne: null }
    }, 'categoryId')

    const eventsWithCatgoriesFound = await models.Event.find({
      projectId,
      categoryId: { $ne: null }
    }, 'categoryId')

    const cfCategIds = []
    const evCategIds = []

    for (const cf of customFieldsWithCatgoriesFound) {
      const hasCid = cfCategIds.includes(String(cf.categoryId))
      if (!hasCid) cfCategIds.push(String(cf.categoryId))
    }

    for (const ev of eventsWithCatgoriesFound) {
      const hasCid = evCategIds.includes(String(ev.categoryId))
      if (!hasCid) evCategIds.push(String(ev.categoryId))
    }

    const outlookCategoriesFound = await models.OutlookCategory.find({ _id: { $in: [...cfCategIds, ...evCategIds] } })
    const outlookCategoriesFoundIds = outlookCategoriesFound.map((olc) => (olc._id))

    const pecOlcIds = projectEventCategories.map((e) => e.categoryId).filter((cId) => !!cId)

    const outlookCategoriesToLocalise = outlookCategoriesFound
      .filter((olc) =>
        !pecOlcIds.find(olcId => isSameId(olc._id, olcId)) &&
        (evCategIds.includes(String(olc._id)) || cfCategIds.includes(String(olc._id)))
      )

    const localisedOutlookCategories = outlookCategoriesToLocalise.map(olc => ({
      _id: olc._id,
      title: olc.displayName,
      color: olc.color,
      deletedAt: olc.deletedAt,
      allowedGroups: olc.allowedGroups,
      excludeInSync: !!olc.projectIdsExcludedInSync?.find(pId => isSameId(pId, projectId)),
      newId: mongoose.Types.ObjectId(),
    }))

    const newProjectEventCategories = [
      // pec
      ...projectEventCategories.map((pec) => ({
        _id: pec._id,
        title: pec.title,
        color: pec.color || pec.presetColor,
        deletedAt: pec.deletedAt,
        allowedGroups: pec.allowedGroups,
        excludeInSync: pec.excludeInSync,
      })),
      // olc not in pec
      ...localisedOutlookCategories
        .filter(olc => !pecOlcIds.find(olcId => isSameId(olcId, olc._id)))
        .map((olc) => ({
          _id: olc.newId,
          title: olc.title,
          color: olc.color,
          deletedAt: olc.deletedAt,
          allowedGroups: olc.allowedGroups,
          excludeInSync: olc.excludeInSync,
        }))
    ];

    const getLocalCategoryId = (categoryId) => {
      const localCateg = localisedOutlookCategories.find((lolc) => isSameId(lolc._id, categoryId))
      let newLocalCategId = localCateg?.newId;

      if (!newLocalCategId) {
        const peCateg = projectEventCategories.find((pec) => isSameId(pec.categoryId, categoryId));
        newLocalCategId = peCateg?._id;
      }

      return newLocalCategId
    }

    const eventUpdateBulkOps = evCategIds
      .filter(cId => !!getLocalCategoryId(cId))
      .map((cId) => {
        const newLocalCategId = getLocalCategoryId(cId)
        return {
          updateMany: {
            filter: { projectId, categoryId: cId },
            update: { categoryId: newLocalCategId, updatedAt: new Date() }
          }
        };
      });

    const customFieldsUpdateBulkOps = cfCategIds
      .filter(cId => !!getLocalCategoryId(cId))
      .map((cId) => {
        const newLocalCategId = getLocalCategoryId(cId)
        return {
          updateMany: {
            filter: { projectId, categoryId: cId },
            update: { categoryId: newLocalCategId, updatedAt: new Date() }
          }
        };
      });

    await models.Project.updateOne({
      _id: projectId,
    }, {
      eventCategories: newProjectEventCategories,
      updatedAt: new Date(),
    })

    await models.Event.bulkWrite(eventUpdateBulkOps)
    await models.CustomField.bulkWrite(customFieldsUpdateBulkOps)

    loggerInfo('convertCategoriesToLocal', {
      cfCategIds,
      evCategIds,
      localisedOutlookCategories,
      customFieldsUpdateBulkOps,
      eventUpdateBulkOps,
      outlookCategoriesToLocalise,
      newProjectEventCategories,
      outlookCategoriesFoundIds,
      projectEventCategories,
      outlookCategoriesFound,
      eventsWithCatgoriesFound,
    })

  } catch (err) {
    loggerError('convertCategoriesToLocal Error', { err })
    // return err
  }
}

module.exports = {
  disableOutlookSync,
  enableOutlookSync,
  disconnectOutlookSync
}
