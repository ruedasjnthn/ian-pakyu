const { updateOutlookEvent, } = require('../../../../helper/OutlookEventHelper');
const mongoose = require('mongoose');
const { OutlookEventTypes, } = require('../../../../constants/outlook');
const { formatUpdateEventToOutlook, } = require('../../../../helper/EventHelper');
const { CalendarLogActionTypes } = require('../../../../constants/calendar');
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, getOutlookSyncVarsNoClient, getClientForCalendarSync } = require('../../../../helper/OutlookSyncHelper');
const { OutlookCalendarSyncStatus, CalendarSyncLimit } = require('../../../../constants/outlook-calendar');
const { getProjectCategories } = require('../../../../helper/CategoryHelper');
const { syncEventsInCalUpdLogs } = require('../../calendarUpdateLogs');
const { ApolloError } = require('apollo-server-express');
// limit of issue to process
const maxLimit = CalendarSyncLimit.EVENT_LIMIT

const getHasMoreEvents = async ({ models, eventsFilter }) => {
  const eventsCount = await models.Event.count(eventsFilter)

  const totalCount = eventsCount
    ? eventsCount
    : 0

  const hasMore = totalCount > maxLimit

  return hasMore
}

// sync issues 
const syncUpdatedEvents = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.SYNCING_UPDATED_EVENTS
    })

    const { tokens, timeZone } = await getOutlookSyncVarsNoClient({ models, projectId })

    const projectCategories = await getProjectCategories({ projectId })

    const outlookSyncAggregate = await models.OutlookSync.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(outlookSyncId)
        }
      },
      {
        $project: {
          singleEventsUpdated: 1,
          seriesOccurrenceEvents: 1,
          syncedUpdatedEventsIds: 1,
        }
      },
      {
        $set: {
          singleEventsUpdatedOutlookIds: {
            "$map": {
              "input": "$singleEventsUpdated",
              "as": "singleEventsUpdated",
              "in": "$$singleEventsUpdated.outlookId"
            }
          }
        },
        $set: {
          seriesOccurrenceEventsOutlookIds: {
            "$map": {
              "input": "$seriesOccurrenceEvents",
              "as": "seriesOccurrenceEvent",
              "in": "$$seriesOccurrenceEvent.outlookId"
            }
          }
        }
      },
      {
        $project: {
          singleEventsUpdatedOutlookIds: 1,
          seriesOccurrenceEventsOutlookIds: 1,
          syncedUpdatedEventsIds: 1,
          lastSyncInitStartAt: 1
        }
      }
    ])

    const outlookSyncFound = outlookSyncAggregate && outlookSyncAggregate[0]
    if (!outlookSyncFound) throw new ApolloError('outlook_sync_not_found')

    const singleEventsUpdatedOutlookIds = outlookSyncFound.singleEventsUpdatedOutlookIds || []
    const seriesOccurrenceEventsOutlookIds = outlookSyncFound.seriesOccurrenceEventsOutlookIds || []
    const lastSyncInitStartAt = outlookSyncFound.seriesOccurrenceEventsOutlookIds || []

    const updatedOlEventOutlookIds = [
      ...singleEventsUpdatedOutlookIds,
      ...seriesOccurrenceEventsOutlookIds
    ]

    const syncedUpdatedEventsIds = outlookSyncFound.syncedUpdatedEventsIds || []

    const updatedEventLogs = await models.CalendarUpdateLog.find({
      projectId,
      action: CalendarLogActionTypes.UPDATE,
      synced: false,
      eventId: { $ne: null }
    }).sort('-date')

    const updatedDbEventIds = updatedEventLogs.map(l => l.eventId)

    const eventsFilter = {
      $and: [
        { _id: { $in: updatedDbEventIds || [] }, },
        { _id: { $nin: syncedUpdatedEventsIds }, },
        { outlookId: { $not: { $eq: null }, }, },
        { outlookId: { $nin: updatedOlEventOutlookIds }, },
      ],
      // $and: [
      //   {
      //     $and: [
      //       { _id: { $in: updatedDbEventIds || [] }, },
      //       { _id: { $nin: syncedUpdatedEventsIds }, },
      //     ]
      //   },
      //   {
      //     $and: [
      //       { outlookId: { $not: { $eq: null }, }, },
      //       { outlookId: { $nin: updatedOlEventOutlookIds }, },
      //     ]
      //   },
      // ],
      projectId,
      type: {
        $in: [
          OutlookEventTypes.EXCEPTION,
          OutlookEventTypes.SERIES_MASTER,
          OutlookEventTypes.SINGLE_INSTANCE
        ]
      },
      // updatedAt: {$gte: }
    };

    const syncedEventsToUpdateFound = await models.Event.find(eventsFilter).limit(maxLimit);

    const hasMoreEvents = await getHasMoreEvents({ models, eventsFilter })

    loggerInfo({
      eventsFilter,
      hasMoreEvents,
      syncedEventsToUpdateFoundL: syncedEventsToUpdateFound.length,
      syncedUpdatedEventsIds,
      syncedEventsToUpdateFoundIds: syncedEventsToUpdateFound.map(e => e._id)
    })


    // eventsToUpdateInOutlook props:
    //  {
    //   reqId: ObjectId,
    //   outlookId: String,
    //   * note: spread formattedEvents for other props *
    //   ...formattedEvent: Object,
    // }
    const eventsToUpdateInOutlook = []

    // UPDATE in outlook  
    for (const syncedEvent of syncedEventsToUpdateFound) {
      const formattedSyncedEvent = formatUpdateEventToOutlook(
        syncedEvent,
        timeZone,
        projectCategories
      )
      loggerInfo('event to Update formattedSyncedEvent: ', JSON.stringify(formattedSyncedEvent))

      if (formattedSyncedEvent) {
        const reqId = syncedEvent._id
        eventsToUpdateInOutlook.push({
          reqId,
          outlookId: syncedEvent.outlookId,
          ...formattedSyncedEvent,
        })
        // const updatedEvent = await updateOutlookEvent(
        //   client,
        //   syncedEvent.outlookId,
        //   formattedSyncedEvent,
        //   projectCategories
        // )
        // loggerInfo({ updatedEvent })
        // if (updatedEvent) {
        //   updatedEventIds.push(syncedEvent._id)
        //   if (syncedEvent.type === OutlookEventTypes.SERIES_MASTER)
        //     masterSeriesEventsToUpdateInOutlook.push(syncedEvent)
        // }
      }
    }

    const masterSeriesEventsToUpdateInOlOutlookIds = new Set()
    const updatedEventsIds = []

    if (eventsToUpdateInOutlook.length > 0) {
      const client = await getClientForCalendarSync({ models, projectId, tokens })
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

        // }

        // for (const updatedEvent of updatedOutlookEvents) {
        const eventType = updatedEvent.type
        const outlookId = updatedEvent.outlookId
        updatedEventsIds.push(updatedEvent.resId)
        if (eventType === OutlookEventTypes.SERIES_MASTER) {
          masterSeriesEventsToUpdateInOlOutlookIds.add(outlookId)
        }
      }
    }

    if (updatedEventsIds.length > 0)
      await syncEventsInCalUpdLogs({
        _projectId: projectId,
        _eventIds: updatedEventsIds,
        _action: CalendarLogActionTypes.UPDATE
      })

    loggerInfo({
      syncedEventsToUpdateFound: syncedEventsToUpdateFound.map(e => e._id),
      updatedEventsIds
    })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: hasMoreEvents
          ? OutlookCalendarSyncStatus.READY_TO_SYNC_UPDATED_EVENTS
          : OutlookCalendarSyncStatus.DONE_TO_SYNC_UPDATED_EVENTS,
        updatedAt: new Date(),
        $addToSet: {
          masterSeriesEventsToUpdateInOlOutlookIds: { $each: [...masterSeriesEventsToUpdateInOlOutlookIds] },
          syncedUpdatedEventsIds: { $each: updatedEventsIds }
        }
      }
    );

    return outlookSyncId

  } catch (err) {
    loggerError('syncUpdatedEvents ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_SYNC_UPDATED_EVENTS,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err

  }
}

module.exports = {
  syncUpdatedEvents,
}
