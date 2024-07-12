const { getEventInOutlookBatch } = require('../../../../helper/OutlookEventHelper');
const mongoose = require('mongoose');
const { OutlookEventTypes, EVENT_LATEST_CHANGE, CalendarRangeFilter } = require('../../../../constants/outlook');
const moment = require("moment");
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, getMsGraphClient } = require('../../../../helper/OutlookSyncHelper');
const { OutlookCalendarSyncStatus, CalendarSyncLimit } = require('../../../../constants/outlook-calendar');
const { ApolloError } = require('apollo-server-express');
const { isEventModified } = require('../../../../helper/SyncHelper');

// limit of issue to process
const maxLimit = 5

const skipMessage = (outlookId, message) => {
  loggerInfo('skipLoop syncUpdatedSeriesEvents', { outlookId, message })
}

const getEventLatestChange = (lastModifiedDateTime, eventLog) => {
  const hasEventLogDate = !!(eventLog && eventLog.date)
  const isEventFromDdLatestChange = hasEventLogDate &&
    moment(eventLog.date).isAfter(lastModifiedDateTime)

  return isEventFromDdLatestChange
    ? EVENT_LATEST_CHANGE.FROM_DB
    : EVENT_LATEST_CHANGE.FROM_OUTLOOK
}

const getHasEventChanges = (masterEvent, event, outlookEvent) => {

  const isModified = isEventModified(
    event,
    {
      ...masterEvent,
      ...outlookEvent,
    }
  )

  loggerInfo({
    isModified,
    eventObj: {
      ...masterEvent,
      ...outlookEvent,
    }
  })

  return isModified
}

// sync issues 
const syncUpdatedSeriesEvents = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    const startTime = new Date()
    loggerInfo({ startTime })

    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.SYNCING_UPDATED_SERIES_EVENTS
    })

    const outlookSyncAggregate = await models.OutlookSync.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(outlookSyncId)
        }
      },
      {
        $set: {
          seriesMasterEvents: {
            $filter: {
              input: "$seriesMasterEvents",
              as: "seriesMasterEvent",
              cond: {
                $not: {
                  $in: [
                    "$$seriesMasterEvent.outlookId",
                    {
                      "$ifNull": [
                        "$syncedSeriesMasterEventsOutlookIds",
                        []
                      ]
                    }
                  ]
                }
              }
            }
          }
        },
      },
      {
        $set: {
          seriesMasterEventsOutlookIds: {
            "$map": {
              "input": "$seriesMasterEvents",
              "as": "seriesMasterEvent",
              "in": "$$seriesMasterEvent.outlookId"
            }
          },
          hasMoreSeriesMasterEvents: {
            "$toBool": {
              "$gt": [
                {
                  "$size": "$seriesMasterEvents"
                },
                maxLimit
              ]
            }
          },
        }
      },
      {
        $project: {
          hasMoreSeriesMasterEvents: 1,
          seriesMasterEvents: {
            "$slice": [
              "$seriesMasterEvents",
              maxLimit
            ],
          },
          singleEventsUpdated: 1,
          seriesMasterEventsOutlookIds: 1,
          lastSyncInitStartAt: 1,
          seriesOccurrenceEvents: 1,
          masterSeriesEventsToUpdateInOlOutlookIds: 1,
          masterSeriesEventsToUpdateInDbOutlookIds: 1,
        }
      },
    ])

    const outlookSyncFound = outlookSyncAggregate && outlookSyncAggregate[0]
    if (!outlookSyncFound) throw new ApolloError('outlook_sync_not_found')

    const seriesMasterEvents = outlookSyncFound.seriesMasterEvents || []
    const singleEventsUpdated = outlookSyncFound.singleEventsUpdated || []

    const masterSeriesEventsToUpdateInOlOutlookIds = new Set(outlookSyncFound.masterSeriesEventsToUpdateInOlOutlookIds || [])
    const masterSeriesEventsToUpdateInDbOutlookIds = new Set(outlookSyncFound.masterSeriesEventsToUpdateInDbOutlookIds || [])

    const seriesMasterEventsOutlookIds = outlookSyncFound.seriesMasterEventsOutlookIds || []
    const outlookUpdatedOccurenceEvents = outlookSyncFound.seriesOccurrenceEvents || []
    const outlookUpdatedExceptionEvents = singleEventsUpdated.filter(e => e.type === OutlookEventTypes.EXCEPTION)
    const outlookUpdatedSeriesEvents = [...outlookUpdatedOccurenceEvents, ...outlookUpdatedExceptionEvents]

    // const outlookUpdatedOccurrenceEventsOlIds = new Set(outlookUpdatedOccurenceEvents.map(e => e.outlookId))
    const outlookUpdatedExceptionEventsOlIds = new Set(outlookUpdatedExceptionEvents.map(e => e.outlookId))
    const outlookUpdatedSeriesEventsOlIds = new Set(outlookUpdatedSeriesEvents.map(e => e.outlookId))

    const lastSyncInitStartAt = outlookSyncFound.lastSyncInitStartAt
    const hasMoreSeriesMasterEvents = outlookSyncFound.hasMoreSeriesMasterEvents

    loggerInfo('syncUpdatedSeriesEvents', {
      masterSeriesEventsToUpdateInOlOutlookIds,
      masterSeriesEventsToUpdateInDbOutlookIds,
      seriesMasterEventsOutlookIds,
      lastSyncInitStartAt,
      hasMoreSeriesMasterEvents,
    })
    // const syncedOccurrenceEvents = await models.Event.find({
    //   projectId,
    //   seriesMasterId: { $in: seriesMasterEventsOutlookIds },
    //   fromOutlook: true,
    //   type: OutlookEventTypes.OCCURRENCE,
    // })

    // const appSeriesMasterEvents = await models.Event.find({
    //   projectId,
    //   fromOutlook: { $ne: true },
    //   type: OutlookEventTypes.SERIES_MASTER,
    //   deletedAt: null
    // })

    const syncedMasterEvents = await models.Event.find({
      projectId,
      type: OutlookEventTypes.SERIES_MASTER,
      outlookId: { $in: seriesMasterEventsOutlookIds }
    })

    const syncedMasterEventsIds = syncedMasterEvents.map(e => String(e._id))

    const eventLogs = await models.CalendarUpdateLog.find({
      projectId,
      // action: CalendarLogActionTypes.DELETE,
      date: { $gte: lastSyncInitStartAt }
    }).sort('-date')

    const syncedSeriesEventsFound = await models.Event.find({
      projectId,
      type: { $in: [OutlookEventTypes.OCCURRENCE, OutlookEventTypes.EXCEPTION] },
      $and: [
        {
          $or: [
            { seriesMasterId: { $in: seriesMasterEventsOutlookIds }, },
            { seriesMasterId: { $in: syncedMasterEventsIds }, },
          ]
        },
        { ...CalendarRangeFilter },
      ]
      // CalendarRangeFilter is $or object
      // fromOutlook: true,
      // outlookId: { $ne: null },
    })



    loggerInfo({
      // syncedSeriesEventsFound,
      seriesMasterEventsOutlookIds,
      syncedMasterEventsIds
    })

    const eventBulkUpdateOps = []
    const eventsToInsert = []

    const eventsOutlookIdsToCheckIfDeleted = []
    const syncedSeriesMasterEventsOutlookIds = new Set()
    const seriesMasterEventsOlIdsToUndelete = []
    const eventsToUpdateInOutlook = []

    for (const outlookMasterEvent of seriesMasterEvents) {
      const masterOutlookId = outlookMasterEvent.outlookId
      const syncedMasterEvent = syncedMasterEvents.find(e => e.outlookId === masterOutlookId)

      if (!syncedMasterEvent) {
        skipMessage(masterOutlookId, 'syncedMasterEvent not_found')
        continue;
      }
      if (syncedMasterEvent.deletedAt) {
        skipMessage(masterOutlookId, 'syncedMasterEvent is_deleted')
        continue;
      }

      const eventLog = eventLogs.find(e => e.outlookId === masterOutlookId)

      const isEventFromOutlook = syncedMasterEvent.fromOutlook
      const syncedMasterEventId = syncedMasterEvent._id

      const seriesMasterId = isEventFromOutlook
        ? masterOutlookId
        : String(syncedMasterEventId)

      const eventLatestChange = getEventLatestChange(
        outlookMasterEvent.lastModifiedDateTime,
        eventLog
      )

      seriesMasterEventsOlIdsToUndelete.push(outlookMasterEvent.outlookId)

      loggerInfo({
        outlookMasterEvent,
        isEventFromOutlook,
        eventLog,
        eventLatestChange,
        seriesMasterId
      })


      const hasMasterEventChangesInOutlook = masterSeriesEventsToUpdateInOlOutlookIds.has(masterOutlookId)
      const seriesEvents = syncedSeriesEventsFound.filter(e => e.seriesMasterId === seriesMasterId)

      const deletedSeriesEventsInOutlook = seriesEvents.filter(e =>
        Boolean(e.outlookId) &&
        !e.deletedAt &&
        !outlookUpdatedSeriesEventsOlIds.has(e.outlookId))


      loggerInfo({
        seriesEvents: seriesEvents.map(e => e._id),
        deletedSeriesEventsInOutlook
      })

      for (const event of deletedSeriesEventsInOutlook) {
        eventsOutlookIdsToCheckIfDeleted.push(event.outlookId)
      }

      if (eventLatestChange === EVENT_LATEST_CHANGE.FROM_OUTLOOK) {


        for (const event of seriesEvents) {
          const eventOutlookId = event.outlookId
          const outlookOccEvent = outlookUpdatedOccurenceEvents.find(e => e.outlookId === eventOutlookId)
          const hasEventChanges = getHasEventChanges(outlookMasterEvent, event, outlookOccEvent)
          const isEventAnException = event.type === OutlookEventTypes.EXCEPTION

          const isOutlookIdUpdatedExceptionEvent = !!outlookUpdatedExceptionEventsOlIds.has(eventOutlookId)

          const shouldUpdate = hasMasterEventChangesInOutlook ||
            hasEventChanges ||
            (isEventAnException && !isOutlookIdUpdatedExceptionEvent)


          if (shouldUpdate && outlookOccEvent) {
            eventBulkUpdateOps.push({
              updateOne: {
                filter: {
                  _id: mongoose.Types.ObjectId(event._id),
                },
                update: {
                  start: outlookOccEvent.start,
                  end: outlookOccEvent.end,

                  type: outlookOccEvent.type,

                  outlookId: outlookOccEvent.outlookId,
                  seriesMasterId: seriesMasterId,

                  // projectId,

                  updatedAt: new Date(),
                  fromOutlook: isEventFromOutlook,
                  ...event.deletedAt && { deletedAt: null, },
                  // createdAt: even.createdAt,
                  userIds: syncedMasterEvent.userIds,

                  title: outlookMasterEvent.title || ' ',
                  location: outlookMasterEvent.location,
                  notes: outlookMasterEvent.notes,
                  isAllDay: Boolean(outlookMasterEvent.isAllDay),
                  categoryId: outlookMasterEvent.categoryId,
                  isRecurrenceEditable: outlookMasterEvent.isRecurrenceEditable,

                  sensitivity: outlookMasterEvent.sensitivity,
                  showAs: outlookMasterEvent.showAs,
                }
              }
            })
          }
        }

        const newOccurrenceEvents = outlookUpdatedOccurenceEvents.filter(occEv => {
          const isSeriesMasterIdMatched = occEv.seriesMasterId === masterOutlookId
          const isOutlookInSyncedEventsFound = syncedSeriesEventsFound.find(syncedEv =>
            syncedEv.outlookId === occEv.outlookId
          )
          loggerInfo('newOccurrenceEvents_filter', {
            masterOutlookId,
            isOutlookInSyncedEventsFound,
            isSeriesMasterIdMatched,
            occEvOutlookId: occEv.outlookId
          })
          return isSeriesMasterIdMatched && !isOutlookInSyncedEventsFound
        })

        loggerInfo({ newOccurrenceEvents })


        for (const newOccurrenceEvent of newOccurrenceEvents) {
          const duplicateEvent = eventsToInsert.find(e => e.outlookId === newOccurrenceEvent.outlookId)
          if (!duplicateEvent)
            eventsToInsert.push({
              start: newOccurrenceEvent.start,
              end: newOccurrenceEvent.end,

              seriesMasterId: seriesMasterId,
              outlookId: newOccurrenceEvent.outlookId,
              type: newOccurrenceEvent.type,
              projectId,
              fromOutlook: isEventFromOutlook,
              createdAt: new Date(),

              title: outlookMasterEvent.title || ' ',
              location: outlookMasterEvent.location,
              notes: outlookMasterEvent.notes,
              userIds: syncedMasterEvent.userIds,

              isAllDay: Boolean(outlookMasterEvent.isAllDay),
              categoryId: outlookMasterEvent.categoryId,
              isRecurrenceEditable: outlookMasterEvent.isRecurrenceEditable,

              sensitivity: outlookMasterEvent.sensitivity,
              showAs: outlookMasterEvent.showAs,
            })
        }
      }

      syncedSeriesMasterEventsOutlookIds.add(outlookMasterEvent.outlookId)
    }


    loggerInfo('eventsOutlookIdsToCheckIfDeleted', {
      eventsOutlookIdsToCheckIfDeleted,
      eventsToUpdateInOutlook
    })

    let client;

    if (seriesMasterEventsOlIdsToUndelete.length > 0)
      await models.Event.updateMany(
        { projectId, outlookId: { $in: seriesMasterEventsOlIdsToUndelete } },
        { deletedAt: null }
      )

    if (eventBulkUpdateOps.length > 0)
      await models.Event.bulkWrite(eventBulkUpdateOps)

    if (eventsToInsert.length > 0)
      await models.Event.insertMany(eventsToInsert)

    const hasEventToDeleteInDb = eventsOutlookIdsToCheckIfDeleted.length > 0
    // const hasEventToDeleteInOutlook = eventsOutlookIdsToDeleteInOutlook.size > 0


    // if (hasEventToDeleteInDb || hasEventToDeleteInOutlook) {
    if (hasEventToDeleteInDb) {
      client = await getMsGraphClient(client, models, projectId)


      if (hasEventToDeleteInDb) {
        const eventsResults = await getEventInOutlookBatch(client, eventsOutlookIdsToCheckIfDeleted)

        const outlookIdsToDelete = eventsResults.filter(e => !!e.eventNotFound).map(e => e.resId)
        loggerInfo('outlookIdsToDelete', { outlookIdsToDelete })

        if (outlookIdsToDelete.length > 0)
          await models.Event.updateMany(
            { projectId, outlookId: { $in: outlookIdsToDelete } },
            { deletedAt: new Date() }
          )
      }

    }


    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: hasMoreSeriesMasterEvents
          ? OutlookCalendarSyncStatus.READY_TO_SYNC_UPDATED_SERIES_EVENTS
          : OutlookCalendarSyncStatus.DONE_TO_SYNC_UPDATED_SERIES_EVENTS,
        updatedAt: new Date(),
        $addToSet: {
          syncedSeriesMasterEventsOutlookIds: { $each: [...syncedSeriesMasterEventsOutlookIds] },
          // recentlyCreatedSeriesMasterEventsOutlookIds: { $each: [...createdSeriesMasterOutlookIds] },
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
    loggerError('syncUpdatedSeriesEvents ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_SYNC_UPDATED_SERIES_EVENTS,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err

  }
}

module.exports = {
  syncUpdatedSeriesEvents,
}
