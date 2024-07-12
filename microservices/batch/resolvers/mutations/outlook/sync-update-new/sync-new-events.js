const { createOutlookEventsPerBatch, } = require('../../../../helper/OutlookEventHelper');
const mongoose = require('mongoose');
const { OutlookEventTypes, CalendarSyncRange, RecurrenceRangeType, CalendarRangeFilter } = require('../../../../constants/outlook');
const { formatEventToOutlook, } = require('../../../../helper/EventHelper');
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, getOutlookSyncVarsNoClient, getClientForCalendarSync } = require('../../../../helper/OutlookSyncHelper');
const { OutlookCalendarSyncStatus, CalendarSyncLimit } = require('../../../../constants/outlook-calendar');
const { getProjectCategories, getExcludedInSyncCategories } = require('../../../../helper/CategoryHelper');

// limit of issue to process
const maxLimit = CalendarSyncLimit.ISSUE_EVENT_LIMIT

const getHasMoreEvents = async ({ models, eventsFilter }) => {
  const eventsCount = await models.Event.count(eventsFilter)

  const totalCount = eventsCount
    ? eventsCount
    : 0

  const hasMore = totalCount > maxLimit

  return hasMore
}

const getSeriesMastersInRange = async ({ models, projectId, excludedCategoriesIds }) => {

  const seriesMasterEventsInRange = await models.Event.aggregate([
    {
      $match: {
        projectId: mongoose.Types.ObjectId(projectId),
        type: { $in: [OutlookEventTypes.OCCURRENCE, OutlookEventTypes.EXCEPTION] },
        deletedAt: null,
        archived: { $ne: true },
        seriesMasterId: { $ne: null },
        categoryId: { $nin: excludedCategoriesIds },
        // CalendarRangeFilter is $or object
        ...CalendarRangeFilter,
      }
    },
    { $project: { seriesMasterId: 1 } },
    {
      $group: {
        _id: "$seriesMasterId"
      },
    },
    {
      $set: {
        seriesMasterObjectId: {
          $convert: {
            input: "$_id",
            to: "objectId",
            onError: null,
            // Optional.
            onNull: null// Optional.

          }
        },

      }
    },
    {
      $set: {
        seriesMasterOutlookId: {
          "$cond": {
            "if": {
              $eq: [
                "$seriesMasterObjectId",
                null
              ]
            },
            "then": "$_id",
            "else": null
          },

        },

      }
    },
  ])


  const seriesMasterEventOutlookIdsInRange = new Set()
  const seriesMasterEventObjectIdsInRange = new Set()


  for (const event of seriesMasterEventsInRange) {
    const seriesMasterOutlookId = event.seriesMasterOutlookId
    const seriesMasterObjectId = event.seriesMasterObjectId

    if (seriesMasterObjectId) seriesMasterEventObjectIdsInRange.add(mongoose.Types.ObjectId(seriesMasterObjectId))
    else seriesMasterEventOutlookIdsInRange.add(seriesMasterOutlookId)

  }

  // loggerInfo({
  //   seriesMasterEventsInRange: JSON.stringify(seriesMasterEventsInRange),
  // })

  return {
    seriesMasterEventOutlookIdsInRange: [...seriesMasterEventOutlookIdsInRange],
    seriesMasterEventObjectIdsInRange: [...seriesMasterEventObjectIdsInRange],
  }
}

// sync issues 
const syncNewEvents = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    const startTime = new Date()

    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.SYNCING_NEW_EVENTS
    })

    const {
      tokens,
      outlookCalendarId,
      timeZone,
    } = await getOutlookSyncVarsNoClient({
      models,
      projectId,
    })

    const projectCategories = await getProjectCategories({ projectId })
    const excludedCategoriesIds = getExcludedInSyncCategories({ projectCategories, projectId })

    const startDateTime = CalendarSyncRange.getStart()
    const endDateTime = CalendarSyncRange.getEnd()

    loggerInfo('createEventsInOutlook', { startDateTime, endDateTime, excludedCategoriesIds })
    loggerInfo({ s: new Date().toTimeString() })
    const {
      seriesMasterEventObjectIdsInRange,
      seriesMasterEventOutlookIdsInRange,
    } = await getSeriesMastersInRange({
      models,
      projectId,
      excludedCategoriesIds
    })
    loggerInfo({ e: new Date().toTimeString() })
    const eventsFilter = {
      projectId,
      outlookId: null,
      deletedAt: null,
      archived: { $ne: true },
      categoryId: { $nin: excludedCategoriesIds },
      $or: [
        // for single events
        {
          type: { $in: [OutlookEventTypes.SINGLE_INSTANCE, null] },
          // CalendarRangeFilter is $or object
          ...CalendarRangeFilter,
        },
        // for series master events events
        {
          type: OutlookEventTypes.SERIES_MASTER,
          $or: [
            {
              $or: [
                { _id: { $in: seriesMasterEventObjectIdsInRange } },
                { outlookId: { $in: seriesMasterEventOutlookIdsInRange } },
              ]
            },
            {
              $and: [
                {
                  $or: [
                    { _id: { $in: seriesMasterEventObjectIdsInRange } },
                    { outlookId: { $in: seriesMasterEventOutlookIdsInRange } },
                  ]
                },
                { "recurrence.range.type": RecurrenceRangeType.NO_END }
              ],
            },
          ],
        },
      ],

    }

    const hasMoreEvents = await getHasMoreEvents({ models, eventsFilter })

    // get events in db
    const eventsFound = await models.Event.find(eventsFilter).limit(maxLimit)

    const eventsToCreateInOutlook = []
    const syncedEventsIds = new Set()

    for (const event of eventsFound) {
      loggerInfo({ event })

      const formattedEvent = formatEventToOutlook(event, timeZone, projectCategories);
      if (formattedEvent) {
        const eventId = event._id
        const reqId = eventId

        syncedEventsIds.add(eventId)

        eventsToCreateInOutlook.push({
          reqId,
          ...formattedEvent
        })


        // loggerInfo('create-event-debug', { createdEvent })
        // if (createdEvent) {
        //   createdOutlookIds.push(createdEvent.outlookId)
        //   createEventsBulkOps.push({
        //     updateOne: {
        //       filter: { _id: mongoose.Types.ObjectId(event.id) },
        //       update: { outlookId: createdEvent.outlookId, updatedAt: new Date() }
        //     }
        //   })
        //   if (createdEvent.type === OutlookEventTypes.SERIES_MASTER)
        //     createdSeriesMasterOutlookIds.push(createdEvent.outlookId)
        // }
      }
    }

    const createdOutlookIds = new Set()
    const createdSeriesMasterOutlookIds = new Set()
    const updateEventsBulkOps = []

    if (eventsToCreateInOutlook.length > 0) {
      const client = await getClientForCalendarSync({ models, projectId, tokens })
      const createdEvents = await createOutlookEventsPerBatch(
        client,
        eventsToCreateInOutlook,
        outlookCalendarId,
        projectCategories
      )


      for (const createdEvent of createdEvents) {
        loggerInfo('create-event-debug', { createdEvent })
        const eventId = createdEvent.resId

        createdOutlookIds.add(createdEvent.outlookId)

        updateEventsBulkOps.push({
          updateOne: {
            filter: { _id: mongoose.Types.ObjectId(eventId) },
            update: {
              outlookId: createdEvent.outlookId,
              type: createdEvent.type,
              updatedAt: new Date()
            }
          }
        })

        if (createdEvent.type === OutlookEventTypes.SERIES_MASTER)
          createdSeriesMasterOutlookIds.add(createdEvent.outlookId)
      }

      loggerInfo({
        createdOutlookIds,
        createdSeriesMasterOutlookIds,
        // updateEventsBulkOps,
        // eventsToCreateInOutlook: JSON.stringify(eventsToCreateInOutlook),
        createdSeriesMasterOutlookIds,
      })
    }

    if (updateEventsBulkOps.length > 0)
      await models.Event.bulkWrite(updateEventsBulkOps);

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: hasMoreEvents
          ? OutlookCalendarSyncStatus.READY_TO_SYNC_NEW_EVENTS
          : OutlookCalendarSyncStatus.DONE_TO_SYNC_NEW_EVENTS,
        updatedAt: new Date(),
        $addToSet: {
          recentlyCreatedEventsOutlookIds: { $each: [...createdOutlookIds] },
          recentlyCreatedSeriesMasterEventsOutlookIds: { $each: [...createdSeriesMasterOutlookIds] },
          syncedEventsIds: { $each: [...syncedEventsIds] },
        }
      }
    );
    const endTime = new Date()
    loggerInfo({
      startTime: startTime.toTimeString(),
      endTime: endTime.toTimeString(),
      timeDiff: ((endTime - startTime) / 1000) + 's'
    })

    return outlookSyncId

  } catch (err) {
    loggerError('syncNewEvents ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_SYNC_NEW_EVENTS,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err

  }
}

module.exports = {
  syncNewEvents,
}
