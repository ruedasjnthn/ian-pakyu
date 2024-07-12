const { deleteOutlookEvents20PerBatch, updateOutlookEvent } = require('../../../../helper/OutlookEventHelper');
const mongoose = require('mongoose');
const { OutlookEventTypes } = require('../../../../constants/outlook');
const {  formatUpdateEventToOutlook, } = require('../../../../helper/EventHelper');
const moment = require("moment");
const momentTz = require("moment-timezone");
const { dateComparingFormat, defaultTimeZone } = require('../../../../constants/calendar');
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, getOutlookSyncVarsNoClient, getMsGraphClient } = require('../../../../helper/OutlookSyncHelper');
const { OutlookCalendarSyncStatus, CalendarSyncLimit } = require('../../../../constants/outlook-calendar');
const { getProjectCategories } = require('../../../../helper/CategoryHelper');
const { ApolloError } = require('apollo-server-express');

// limit of series events to process
const occurenceEventsMaxLimit = CalendarSyncLimit.OCCURRENCE_EVENT_LIMIT
// const maxOccEvsLimit = 300

const skipSeriesEvent = async ({ models, outlookSyncId, seriesMasterId, hasMoreSeriesEvents, logMessage }) => {
  await models.OutlookSync.updateOne(
    { _id: outlookSyncId },
    {
      status: hasMoreSeriesEvents
        ? OutlookCalendarSyncStatus.READY_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS
        : OutlookCalendarSyncStatus.DONE_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS,
      updatedAt: new Date(),
      logMessage: '(skipSeriesEvent) seriesMasterId: ' + seriesMasterId + ', ' + logMessage
    }
  );
}

const getMatchingEvent = ({ eventsList, event, timeZone }) => {
  const matchingEvent = eventsList.find(e => {
    const eStartUtc = moment.utc(e.start).format(dateComparingFormat);
    const eventStartUtc = moment.utc(event.start).format(dateComparingFormat);
    const isDateSameUtc = moment(eStartUtc).isSame(eventStartUtc);

    loggerInfo('getMatchingEvent', {
      eStartUtc,
      eventStartUtc,
      isDateSameUtc,
      'event._id': event._id,
      'event.type': event.type,
    })
    if (isDateSameUtc) return isDateSameUtc

    const eStart = momentTz(e.start).tz('UTC').format(dateComparingFormat);
    const eventStart = momentTz(event.start).tz(timeZone || defaultTimeZone).format(dateComparingFormat);

    const isDateSame = moment(eStart).isSame(eventStart);
    loggerInfo('getMatchingEvent', {
      eStart,
      eventStart,
      isDateSame,
      'event._id': event._id,
      'event.type': event.type,
    })
    return isDateSame
  })
  loggerInfo('getMatchingEvent result', {
    matchingEvent,
    event
  })

  return matchingEvent
}

// note: this should be called more frequently
// sync newly created outlook series  
// save Outlook Ids Of Occurrence Events
const syncNewOutlookSeriesEvents = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.SYNCING_NEW_OUTLOOK_SERIES_EVENTS
    })

    const { tokens, timeZone } = await getOutlookSyncVarsNoClient({ models, projectId, })

    const projectCategories = await getProjectCategories({ projectId })

    const outlookSyncAggregate = await models.OutlookSync.aggregate([
      {
        $match: { _id: mongoose.Types.ObjectId(outlookSyncId) }
      },
      {
        $project: {
          newlyCreatedSeriesEvents: 1,
          matchedExceptionEventIds: 1,
          masterSeriesEventsToUpdateInOlOutlookIds: 1,
        }
      },
      {
        $set: {
          newlyCreatedSeriesEventsNotSynced: {
            "$filter": {
              "input": "$newlyCreatedSeriesEvents",
              "as": "newlyCreatedSeriesEvents",
              "cond": {
                $not: {
                  $eq: [
                    "$$newlyCreatedSeriesEvents.synced",
                    true
                  ]
                }
              }
            }
          }
        }
      },
      {
        $set: {
          newlyCreatedSeriesEventToSync: {
            "$ifNull": [
              { $first: "$newlyCreatedSeriesEventsNotSynced" },
              null
            ]
          },
          hasMoreSeriesEventsToSync: {
            "$toBool": {
              "$ifNull": [
                {
                  $arrayElemAt: [
                    "$newlyCreatedSeriesEventsNotSynced",
                    1
                  ]
                },
                false
              ]
            }
          }
        }
      },
      {
        $set: {
          "newlyCreatedSeriesEventToSync.occurenceEvents": {
            "$filter": {
              "input": "$newlyCreatedSeriesEventToSync.occurenceEvents",
              "as": "occurenceEvent",
              "cond": {
                $not: {
                  $in: [
                    "$$occurenceEvent.outlookId",
                    "$newlyCreatedSeriesEventToSync.syncedOccEventsOutlookIds"
                  ]
                }
              }
            }
          }
        }
      },
      {
        $set: {
          "newlyCreatedSeriesEventToSync.occurenceEvents": {
            "$slice": [
              "$newlyCreatedSeriesEventToSync.occurenceEvents",
              occurenceEventsMaxLimit
            ],
          },
          hasMoreOccurrenceEventsToSync: {
            "$toBool": {
              "$gt": [
                {
                  "$size": {
                    "$ifNull": [
                      "$newlyCreatedSeriesEventToSync.occurenceEvents",
                      []
                    ]
                  }
                },
                occurenceEventsMaxLimit
              ]
            }
          }
        }
      },
      // {
      //   "$unwind": "$newlyCreatedSeriesEventToSync"
      // },
      {
        $project: {
          newlyCreatedSeriesEventsNotSynced: 1,
          newlyCreatedSeriesEventToSync: 1,
          hasMoreSeriesEventsToSync: 1,
          matchedExceptionEventIds: 1,
          hasMoreOccurrenceEventsToSync: 1,
        }
      },
    ])

    // loggerInfo({ outlookSyncAggregate: JSON.stringify(outlookSyncAggregate) })

    const outlookSyncFound = outlookSyncAggregate && outlookSyncAggregate[0]
    if (!outlookSyncFound) throw new ApolloError('outlook_sync_not_found')

    const hasMoreSeriesEvents = outlookSyncFound.hasMoreSeriesEventsToSync
    const hasMoreOccurrenceEventsToSync = outlookSyncFound.hasMoreOccurrenceEventsToSync
    const matchedExceptionEventIds = outlookSyncFound.matchedExceptionEventIds || []
    const eventToSync = outlookSyncFound.newlyCreatedSeriesEventToSync
    const hasNoSeriesEventToSync = !eventToSync

    loggerInfo({
      'hasNoSeriesEventToSync': Boolean(hasNoSeriesEventToSync),
      'eventToSync.seriesMasterId': eventToSync?.seriesMasterId
    })

    if (hasNoSeriesEventToSync) {
      await skipSeriesEvent({
        logMessage: 'newlyCreatedSeriesEventToSync_not_found',
        models,
        hasMoreSeriesEvents: false,
        outlookSyncId,
        seriesMasterId: null
      })
      return outlookSyncId
    }

    const seriesMasterId = eventToSync.seriesMasterId
    const occurrenceEventsInOutlook = eventToSync.occurenceEvents || []
    const occurrenceEventsInOutlookOlIds = occurrenceEventsInOutlook.map(e => e.outlookId)

    loggerInfo({
      // outlookSyncFound: JSON.stringify(outlookSyncFound),
      // newlyCreatedSeriesEventToSync: eventToSync,
      seriesMasterId,
      occurrenceEventsInOutlookL: occurrenceEventsInOutlook.length,
      hasMoreSeriesEvents,
      matchedExceptionEventIds,
      occurrenceEventsInOutlookOlIds
    })

    const occurrenceEventsToInsert = []
    const occurrenceEventsBulkOps = []

    const outlookIdsToDelete = []
    const eventsToUpdate = []

    const masterEvent = await models.Event.findOne({
      projectId,
      deletedAt: null,
      outlookId: seriesMasterId
    });

    if (!masterEvent) {
      await skipSeriesEvent({
        logMessage: 'masterEvent_not_found',
        models,
        hasMoreSeriesEvents,
        outlookSyncId,
        seriesMasterId
      })
      return outlookSyncId
    }

    const projectSeriesEvents = await models.Event.find({
      projectId,
      // deletedAt: null,
      $or: [
        { seriesMasterId: String(masterEvent._id), },
        { seriesMasterId: seriesMasterId },
      ],
      type: { $in: [OutlookEventTypes.OCCURRENCE, OutlookEventTypes.EXCEPTION] }
    });


    const projectExceptionEvents = projectSeriesEvents
      .filter(e => !e.deletedAt && e.type === OutlookEventTypes.EXCEPTION);

    const projectOccurenceEvents = projectSeriesEvents
      .filter(e => !e.deletedAt && e.type === OutlookEventTypes.OCCURRENCE);

    const deletedExceptions = projectSeriesEvents
      .filter(e => !!e.deletedAt && e.type === OutlookEventTypes.EXCEPTION);

    const deletedOccurrences = projectSeriesEvents
      .filter(e => !!e.deletedAt && e.type === OutlookEventTypes.OCCURRENCE);

    // loggerInfo({
    //   projectOccurenceEvents,
    //   projectExceptionEvents,
    // })

    const fromOutlook = Boolean(masterEvent.fromOutlook)
    const masterEventCategoryId = masterEvent.categoryId

    const exceptionEvents = projectExceptionEvents.filter(expEvent =>
      fromOutlook
        ? expEvent.seriesMasterId === seriesMasterId
        : String(expEvent.seriesMasterId) === String(masterEvent._id)
    )
    const occurrenceEventsInDb = projectOccurenceEvents.filter(expEvent =>
      fromOutlook
        ? expEvent.seriesMasterId === seriesMasterId
        : String(expEvent.seriesMasterId) === String(masterEvent._id)
    )

    loggerInfo({
      fromOutlook,
      seriesMasterId,
      masterEvent,
      occurrenceEventsInOutlook,
      'exceptionEvents': exceptionEvents.map(e => e._id),
      'exceptionEventsLength': exceptionEvents.length,
      'projectSeriesEventsLength': projectSeriesEvents.length,
      'projectSeriesEvents': projectSeriesEvents.map(e => e._id),
      '$or': [
        { seriesMasterId: String(masterEvent._id), },
        { seriesMasterId: seriesMasterId },
      ],
    })

    for (const event of occurrenceEventsInOutlook) {
      loggerInfo('occurrenceEventsInOutlook loop', {
        event,
      })
      const dbExpEventMatched = getMatchingEvent({
        eventsList: exceptionEvents,
        event,
        timeZone
      })

      const dbOccEventMatched = getMatchingEvent({
        eventsList: occurrenceEventsInDb,
        event,
        timeZone
      })

      const deletedDbExpEventMatched = getMatchingEvent({
        eventsList: deletedExceptions,
        event,
        timeZone
      })

      const deletedDbOccEventMatched = getMatchingEvent({
        eventsList: deletedOccurrences,
        event,
        timeZone
      })


      // .find(e => {
      //   const eStartUtc = moment.utc(e.start).format(dateComparingFormat);
      //   const eventStartUtc = moment.utc(event.start).format(dateComparingFormat);
      //   const isDateSameUtc = moment(eStartUtc).isSame(eventStartUtc);

      //   loggerInfo('dbEventMatched', {
      //     eStartUtc,
      //     eventStartUtc,
      //     isDateSameUtc,
      //   })
      //   if (isDateSameUtc) return isDateSameUtc

      //   const eStart = momentTz(e.start).tz('UTC').format(dateComparingFormat);
      //   const eventStart = momentTz(event.start).tz(timeZone || defaultTimeZone).format(dateComparingFormat);

      //   const isDateSame = moment(eStart).isSame(eventStart);
      //   loggerInfo('dbEventMatched', {
      //     eStart,
      //     eventStart,
      //     isDateSame,
      //   })
      //   return isDateSame
      // })

      // const dbOccEventMatched = occurrenceEventsInDb.find(e => {
      //   loggerInfo('dbOccEventMatched occurrenceEventsInDb', {
      //     'e.start': e.start,
      //     'event.start': event.start,
      //   })
      //   const eStartUtc = moment.utc(e.start).format(dateComparingFormat);
      //   const eventStartUtc = moment.utc(event.start).format(dateComparingFormat);
      //   const isDateSameUtc = moment(eStartUtc).isSame(eventStartUtc);

      //   loggerInfo('dbOccEventMatched', {
      //     eStartUtc,
      //     eventStartUtc,
      //     isDateSameUtc,
      //   })
      //   if (isDateSameUtc) return isDateSameUtc

      //   const eStart = momentTz(e.start).tz('UTC').format(dateComparingFormat);
      //   const eventStart = momentTz(event.start).tz(timeZone || defaultTimeZone).format(dateComparingFormat);

      //   const isDateSame = moment(eStart).isSame(eventStart);
      //   loggerInfo('dbOccEventMatched', {
      //     eStart,
      //     eventStart,
      //     isDateSame,
      //   })
      //   return isDateSame
      // })

      loggerInfo({
        event,
        dbExpEventMatched: JSON.stringify(dbExpEventMatched),
        dbOccEventMatched: JSON.stringify(dbOccEventMatched),
        masterEventCategoryId,
        deletedDbExpEventMatched,
        deletedDbOccEventMatched,
      })

      // update event if there is an exception event matched
      if (dbExpEventMatched) {

        loggerInfo({
          'dbEventMatched.deletedAt': dbExpEventMatched.deletedAt
        })

        const isExceptionUpdatedAlready = matchedExceptionEventIds.find(eId => String(eId) === String(dbExpEventMatched._id))

        if (!Boolean(dbExpEventMatched.deletedAt)) {
          if (!isExceptionUpdatedAlready) {
            eventsToUpdate.push({
              event: dbExpEventMatched,
              outlookId: event.outlookId
            })
          }
        } else {
          outlookIdsToDelete.push(event.outlookId)
        }

        if (!isExceptionUpdatedAlready) {
          occurrenceEventsBulkOps.push({
            updateOne: {
              filter: { _id: mongoose.Types.ObjectId(dbExpEventMatched._id) },
              update: { outlookId: event.outlookId }
            }
          })
        }

      } else if (dbOccEventMatched) {
        occurrenceEventsBulkOps.push({
          updateOne: {
            filter: { _id: mongoose.Types.ObjectId(dbOccEventMatched._id) },
            update: {
              outlookId: event.outlookId,
              categoryId: masterEventCategoryId,
            }
          }
        })
      } else if (deletedDbExpEventMatched || deletedDbOccEventMatched) {
        outlookIdsToDelete.push(event.outlookId)
      } else {
        const outlookIdExist = occurrenceEventsToInsert.find(e => e.outlookId === event.outlookId)
        if (!outlookIdExist) {
          occurrenceEventsToInsert.push({
            start: event.start,
            end: event.end,
            // start: event.start + 'Z',
            // end: event.end + 'Z',

            seriesMasterId: masterEvent._id,
            outlookId: event.outlookId,
            type: event.type,
            projectId,
            fromOutlook: false,
            createdAt: masterEvent.createdAt,
            updatedAt: new Date(),

            title: masterEvent.title || ' ',
            location: masterEvent.location,
            notes: masterEvent.notes,
            userIds: masterEvent.userIds,

            isAllDay: Boolean(masterEvent.isAllDay),
            categoryId: masterEvent.categoryId,
            isRecurrenceEditable: masterEvent.isRecurrenceEditable,

            showAs: event.showAs,
            sensitivity: event.sensitivity,
          })
        }
      }

    }

    // loggerInfo({
    // occurrenceEventsToInsert,
    // outlookIdsToDelete,
    // eventsToUpdate,
    // occurrenceEventsToInsert: JSON.stringify(occurrenceEventsToInsert),
    // occurrenceEventsBulkOps: JSON.stringify(occurrenceEventsBulkOps),
    // })


    await models.Event.insertMany(occurrenceEventsToInsert)
    await models.Event.bulkWrite(occurrenceEventsBulkOps)

    let client;

    // delete outlook events
    if (outlookIdsToDelete.length > 0) {
      client = await getMsGraphClient(client, models, projectId)
      await deleteOutlookEvents20PerBatch(client, outlookIdsToDelete)
    }

    const eventsToUpdateInOutlook = []

    for (const eventItem of eventsToUpdate) {

      const formattedEvent = formatUpdateEventToOutlook(eventItem.event, timeZone, projectCategories)

      const reqId = mongoose.Types.ObjectId()
      const eventOutlookId = eventItem.outlookId

      eventsToUpdateInOutlook.push({
        reqId,
        outlookId: eventOutlookId,
        ...formattedEvent
      })
    }

    // const updateBatch20Events = {};

    // let updateBatchCount = 1;
    // let updateCount = 1;

    if (eventsToUpdateInOutlook.length > 0) {
      client = await getMsGraphClient(client, models, projectId)
    }

    for (const event of eventsToUpdateInOutlook) {
      const eventOutlookId = event.outlookId
      const updatedEvent = await updateOutlookEvent(
        client,
        eventOutlookId,
        event,
        projectCategories
      )
      loggerInfo({ eventOutlookId, updatedEvent })
    }

    // for (const event of eventsToUpdateInOutlook) {
    //   updateBatch20Events[updateBatchCount] =
    //     [...updateBatch20Events[updateBatchCount] || [], event];

    //   if (updateCount === 12) {
    //     updateCount = 1;
    //     updateBatchCount += 1;
    //   } else updateCount += 1;
    // }


    // for (const batchNumber in updateBatch20Events) {
    //   const eventBatch = updateBatch20Events[batchNumber]
    //   const updatedEvents = await batchUpdateOutlookEvent(
    //     client,
    //     eventBatch,
    //     projectCategories
    //   )

    //   loggerInfo({ updatedEvents })
    // }


    await models.OutlookSync.updateOne(
      {
        _id: outlookSyncId,
        "newlyCreatedSeriesEvents.seriesMasterId": seriesMasterId
      },
      {
        ...!hasMoreOccurrenceEventsToSync && {
          $set: { "newlyCreatedSeriesEvents.$.synced": true },
        },
        $addToSet: {
          "newlyCreatedSeriesEvents.$.syncedOccEventsOutlookIds": {
            $each: occurrenceEventsInOutlookOlIds
          }
        }
      }
    )

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: hasMoreSeriesEvents
          ? OutlookCalendarSyncStatus.READY_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS
          : OutlookCalendarSyncStatus.DONE_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS,
        updatedAt: new Date(),
      }
    );

    return outlookSyncId

  } catch (err) {
    loggerError('syncNewOutlookSeriesEvents ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err
  }
}

module.exports = {
  syncNewOutlookSeriesEvents,
}
