const { deleteOutlookEvents20PerBatch, } = require('../../../../helper/OutlookEventHelper');
const mongoose = require('mongoose');
const moment = require("moment");
const { CalendarLogActionTypes } = require('../../../../constants/calendar');
const { loggerError, loggerInfo } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, getOutlookSyncVars } = require('../../../../helper/OutlookSyncHelper');
const { OutlookCalendarSyncStatus, CalendarSyncLimit } = require('../../../../constants/outlook-calendar');
const { syncEventsInCalUpdLogs } = require('../../calendarUpdateLogs');
const { ApolloError } = require('apollo-server-express');
const { getProjectCategories } = require('../../../../helper/CategoryHelper');
const { CalendarRangeFilter, OutlookEventTypes } = require('../../../../constants/outlook');

// limit of issue to process
const maxLimit = CalendarSyncLimit.EVENT_LIMIT

const getHasMoreDeletedEventLogs = async ({ models, logsFilter }) => {
  const deletedEventLogsCount = await models.CalendarUpdateLog.count(logsFilter)

  const totalCount = deletedEventLogsCount
    ? deletedEventLogsCount
    : 0

  const hasMore = totalCount > maxLimit

  return hasMore
}


// delete synced outlook event 
const deleteSyncedOutlookEvents = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.DELETING_OUTLOOK_EVENTS
    })


    const logsFilter = {
      projectId,
      action: CalendarLogActionTypes.DELETE,
      synced: false,
      eventId: { $ne: null },
      outlookId: { $ne: null }
    }

    const deletedEventLogs = await models.CalendarUpdateLog
      .find(logsFilter)
      .sort('-date')
      .limit(maxLimit);

    const hasMoreDeletedEventLogs = await getHasMoreDeletedEventLogs({ models, logsFilter })

    const deleteEventLogsOutlookIds = deletedEventLogs
      .filter(l => !!l.outlookId)
      .map(l => l.outlookId)

    const outlookSyncAggregate = await models.OutlookSync.aggregate([
      {
        "$match": {
          _id: mongoose.Types.ObjectId(outlookSyncId)
        }
      },
      {
        "$set": {
          singleEventsUpdatedToDelete: {
            "$filter": {
              "input": "$singleEventsUpdated",
              "as": "event",
              "cond": {
                // $not: {
                $in: [
                  "$$event.outlookId",
                  deleteEventLogsOutlookIds
                ]
                // }
              }
            }
          }
        }
      },
      {
        $set: {
          singleEventsUpdatedToDeleteOutlookIds: {
            "$map": {
              "input": "$singleEventsUpdatedToDelete",
              "as": "event",
              "in": "$$event.outlookId"
            }
          }
        }
      },
      {
        "$project": {
          singleEventsUpdatedToDelete: 1,
          singleEventsUpdatedToDeleteOutlookIds: 1,
        }
      }
    ])

    const outlookSyncFound = outlookSyncAggregate && outlookSyncAggregate[0]
    if (!outlookSyncFound) throw new ApolloError('outlook_sync_not_found')

    const singleEventsUpdatedToDelete = outlookSyncFound.singleEventsUpdatedToDelete || []
    const singleEventsUpdatedToDeleteOutlookIds =
      outlookSyncFound.singleEventsUpdatedToDeleteOutlookIds || []

    loggerInfo({
      // singleEventsUpdatedToDelete,
      singleEventsUpdatedToDeleteOutlookIds
    })
    // get deleted events based on calendarUpdateLogs

    // get outlookIds of updated outlook events
    // const updatedOlEventOutlookIds = getEventsOutlookIds(singleEventsUpdated)

    // loggerInfo({ deletedEventLogs, updatedOlEventOutlookIds })

    const eventIdsToDelete = new Set()
    const eventIdsNotDeleted = new Set()
    const eventOutlookIdsToDelete = new Set()

    for (const eventLog of deletedEventLogs) {

      let shouldDelete = true

      const isEventUpdatedInOutlook = !!singleEventsUpdatedToDeleteOutlookIds.includes(eventLog.outlookId)
      loggerInfo({ isEventUpdatedInOutlook })

      // check if event deleted in db has been updated in outlook
      if (isEventUpdatedInOutlook) {

        const updatedEvent = singleEventsUpdatedToDelete.find(e => e.outlookId === eventLog.outlookId)

        // check if event deleted in db is after the update in outlook
        if (updatedEvent && updatedEvent.lastModifiedDateTime) {
          shouldDelete = moment(eventLog.date).isAfter(updatedEvent.lastModifiedDateTime)
        }

      }

      loggerInfo('shouldDelete', {
        // isEventUpdatedInOutlook,
        shouldDelete
      })

      // delete event in outlook
      if (shouldDelete) {
        eventOutlookIdsToDelete.add(eventLog.outlookId)
        eventIdsToDelete.add(eventLog.eventId)
      } else {
        eventIdsNotDeleted.add(eventLog.eventId)
      }
    }

    // delete outlook events with hidden categories - start
    const excludedCategories = await getProjectCategories({ projectId, excluded: true })
    const excludedCategoriesIds = [
      ...excludedCategories.map(c => mongoose.Types.ObjectId(c.id || c._id)),
      ...excludedCategories
        .filter(c => !!c.projectEventCategoryId)
        .map(c => mongoose.Types.ObjectId(c.projectEventCategoryId)),
    ]

    const hiddenEventsFound = await models.Event.find({
      projectId,
      outlookId: {
        $ne: null,
        $nin: deleteEventLogsOutlookIds
      },
      deleted: null,
      categoryId: { $in: excludedCategoriesIds },
      ...CalendarRangeFilter
    }, 'outlookId')


    loggerInfo('delete_outlook_events_with_hidden_categories', {
      excludedCategories,
      excludedCategoriesIds,
      hiddenEventsFound,
    })

    for (const event of hiddenEventsFound) {
      eventOutlookIdsToDelete.add(event.outlookId)
      eventIdsToDelete.add(event._id)
    }

    // end - delete outlook events with hidden categories

    if (eventOutlookIdsToDelete.size > 0) {
      const { client } = await getOutlookSyncVars({ models, projectId, })
      await deleteOutlookEvents20PerBatch(client, [...eventOutlookIdsToDelete])
    }

    loggerInfo({
      deletedEventLogsIds: deletedEventLogs.map(l => l._id),
      eventOutlookIdsToDelete: [...eventOutlookIdsToDelete],
      deleteEventLogsOutlookIds,
      // eventsToDeleteButUpdatedInOutlookOlIds
    })

    if (eventIdsToDelete.size > 0) {
      await models.Event.updateMany(
        { projectId, _id: { $in: [...eventIdsToDelete] }, type: OutlookEventTypes.SERIES_MASTER },
        { outlookId: null, seriesMasterId: null }
      )
      await models.Event.updateMany(
        { projectId, _id: { $in: [...eventIdsToDelete] }, type: { $ne: OutlookEventTypes.SERIES_MASTER } },
        { outlookId: null }
      )
    }

    if (eventIdsToDelete.size > 0 || eventIdsNotDeleted.size > 0)
      await syncEventsInCalUpdLogs({
        _projectId: projectId,
        _action: CalendarLogActionTypes.DELETE,
        _eventIds: [...eventIdsToDelete, ...eventIdsNotDeleted]
      })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: hasMoreDeletedEventLogs
          ? OutlookCalendarSyncStatus.READY_TO_DELETE_OUTLOOK_EVENTS
          : OutlookCalendarSyncStatus.DONE_TO_DELETE_OUTLOOK_EVENTS,

        updatedAt: new Date(),

      }
    );

    return outlookSyncId

  } catch (err) {
    loggerError('syncOutlookEvents ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_DELETE_OUTLOOK_EVENTS,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err

  }
}

module.exports = {
  deleteSyncedOutlookEvents,
}
