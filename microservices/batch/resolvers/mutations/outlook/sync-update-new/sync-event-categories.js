const { updateOutlookEvent } = require('../../../../helper/OutlookEventHelper');
const { OutlookEventTypes } = require('../../../../constants/outlook');
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, getOutlookSyncVars, } = require('../../../../helper/OutlookSyncHelper');
const { OutlookCalendarSyncStatus, CalendarSyncLimit } = require('../../../../constants/outlook-calendar');
const { getProjectCategories } = require('../../../../helper/CategoryHelper');
const { getCategoryNameArray } = require('../../../../helper/SyncHelper');
const { ApolloError } = require('apollo-server-express');

const syncEventCategories = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.SYNCING_EVENT_CATEGORIES
    })


    const projectCategories = await getProjectCategories({ projectId })

    const outlookSyncFound = await models.OutlookSync.findById(
      outlookSyncId,
      'eventCategorySyncedIds issueEventCategorySyncedIds'
    )
    if (!outlookSyncFound) throw new ApolloError('outlook_sync_not_found')

    const eventCategorySyncedIds = outlookSyncFound.eventCategorySyncedIds || []
    const issueEventCategorySyncedIds = outlookSyncFound.issueEventCategorySyncedIds || []

    const lastSyncInitStartAt = outlookSyncFound.lastSyncInitStartAt

    const eventLimit = CalendarSyncLimit.SAVE_EVENT_LIMIT
    const issueLimit = CalendarSyncLimit.SAVE_ISSUE_EVENT_LIMIT

    const cocRenamed = await models.OutlookCategory.find({
      projectId,
      createdAt: { $gte: lastSyncInitStartAt },
      updatedNameCategoryId: { $ne: null },
      deletedAt: null
    })

    let hasMoreIssues = false
    let hasMoreEvents = false

    const syncedEventsIds = new Set()
    const syncedIssueEventsIds = new Set()

    if (cocRenamed.length > 0) {
      const eventsFilter = {
        projectId,
        categoryId: { $in: cocRenamed.map(coc => coc._id), },
        outlookId: { $ne: null },
        _id: { $nin: eventCategorySyncedIds }
      }

      const eventsTotalCount = await models.Event.count(eventsFilter)
      const eventsToUpdate = await models.Event.find(eventsFilter).limit(eventLimit)

      hasMoreEvents = eventsTotalCount > eventLimit

      const cfUpdatedCoc = await models.CustomField.find({
        projectId,
        categoryId: { $in: cocRenamed.map(coc => coc._id), },
      })

      const issuesFilter = {
        projectId,
        "issueCustomFields.fieldId": { $in: cfUpdatedCoc.map(cf => cf._id) },
        _id: { $nin: issueEventCategorySyncedIds }
      }

      const issuesCount = await models.Issue.count(issuesFilter)
      const issueEventsToUpdate = await models.Issue.find(issuesFilter).limit(issueLimit)

      hasMoreIssues = issuesCount > issueLimit

      loggerInfo({
        cfUpdatedCoc: cfUpdatedCoc.map(cf => cf._id),
        issueEventsToUpdate: issueEventsToUpdate.map(e => e._id),
      })


      const eventsToUpdateInOutlook = []

      for (const event of eventsToUpdate) {
        const categories = getCategoryNameArray(cocRenamed, event)
        loggerInfo({ categories })
        if (categories) {
          const reqId = event._id
          eventsToUpdateInOutlook.push({
            reqId,
            outlookId: event.outlookId,
            categories
          })
        }

        syncedEventsIds.add(event._id) 
      }


      for (const issue of issueEventsToUpdate) {

        for (const icf of issue.issueCustomFields) {
          const field = cfUpdatedCoc.find(cf => String(cf.id) === String(icf.fieldId))
          if (field && icf.outlookId) {
            const category = cocRenamed.find(coc => String(coc._id) === String(field.categoryId))
            loggerInfo({ category })
            if (category) {
              const categories = [category.displayName]
              // loggerInfo({ categories })
              // const updatedOlEvent = await updateOutlookEvent(
              //   client,
              //   icf.outlookId,
              //   { categories },
              //   projectCategories
              // )
              const outlookId = icf.outlookId
              const reqId = outlookId
              eventsToUpdateInOutlook.push({
                reqId,
                outlookId,
                categories
              })
              // loggerInfo({ updatedOlEvent })
            }
          }
        }

        syncedIssueEventsIds.add(issue._id)
      }

      const masterSeriesEventsToUpdateInOutlook = []
      const updatedEventsIds = new Set()

      if (eventsToUpdateInOutlook.length > 0) {
        const { client } = await getOutlookSyncVars({ models, projectId })

        // const updatedOutlookEvents = await updateOutlookEventsPerBatch(
        //   client,
        //   eventsToUpdateInOutlook,
        //   projectCategories
        // )

        for (const event of eventsToUpdateInOutlook) {
          const eventOutlookId = event.outlookId
          const updatedEvent = await updateOutlookEvent(
            client,
            eventOutlookId,
            event,
            projectCategories
          )
          loggerInfo({ eventOutlookId, updatedEvent })

          // for (const updatedEvent of updatedOutlookEvents) {
          const eventType = updatedEvent.type
          updatedEventsIds.add(updatedEvent.resId)
          if (eventType === OutlookEventTypes.SERIES_MASTER) {
            masterSeriesEventsToUpdateInOutlook.push(masterSeriesEventsToUpdateInOutlook)
          }
          // }
        }
      }

      // loggerInfo({ eventsToUpdate, })
    }

    loggerInfo({
      cocRenamed,
      lastSyncInitStartAt
    })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {

        status: hasMoreEvents || hasMoreIssues
          ? OutlookCalendarSyncStatus.READY_TO_SYNC_EVENT_CATEGORIES
          : OutlookCalendarSyncStatus.DONE_TO_SYNC_EVENT_CATEGORIES,

        updatedAt: new Date(),

        $addToSet: {
          eventCategorySyncedIds: { $each: [...syncedEventsIds] },
          issueEventCategorySyncedIds: { $each: [...syncedIssueEventsIds] }
        }
      }
    );

    return outlookSyncId

  } catch (err) {
    loggerError('syncEventCategories ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_SYNC_EVENT_CATEGORIES,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err

  }
}

module.exports = {
  syncEventCategories,
}
