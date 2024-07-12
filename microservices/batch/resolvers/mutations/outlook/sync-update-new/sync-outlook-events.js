const { updateOutlookEvent, } = require('../../../../helper/OutlookEventHelper');
const mongoose = require('mongoose');
const { OutlookEventTypes, EVENT_LATEST_CHANGE } = require('../../../../constants/outlook');
const { getOutlookEvent, getEventsOutlookIds, formatUpdateEventToOutlook, getAggregateOpsEventPrefixTitle, getAggregateOpsEventDuration, formatIssueEventToOutlook, } = require('../../../../helper/EventHelper');
const moment = require("moment");
const { CalendarLogActionTypes } = require('../../../../constants/calendar');
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, getProjectCustomFields, getOutlookSyncVarsNoClient, getClientForCalendarSync } = require('../../../../helper/OutlookSyncHelper');
const { OutlookCalendarSyncStatus, CalendarSyncLimit } = require('../../../../constants/outlook-calendar');
const { getProjectCategories } = require('../../../../helper/CategoryHelper');
const { isEventModified, getLatestUpdatedEvent, getIsIssueEventModified } = require('../../../../helper/SyncHelper');
const { syncEventsInCalUpdLogs } = require('../../calendarUpdateLogs');
const { ApolloError } = require('apollo-server-express');

const maxLimit = CalendarSyncLimit.EVENT_LIMIT

const getSyncedEventInDB = (singleEvents, occurrenceEvents, deletedEvents, eventLogs, outlookEvent) => {
  const isOutlookEventException = outlookEvent.type === OutlookEventTypes.EXCEPTION
  const outlookId = outlookEvent.outlookId

  // look for the manual event in db
  let event = getOutlookEvent(singleEvents, outlookId);

  const eventLatestChange = getEventLatestChange(outlookEvent, eventLogs)

  if (eventLatestChange === EVENT_LATEST_CHANGE.FROM_DB) {
    const occurenceEvent = getOutlookEvent(occurrenceEvents, outlookId);
    const deletedEvent = deletedEvents.find(e => e.outlookId === outlookEvent.outlookId)
    if (occurenceEvent) event = occurenceEvent
    else if (deletedEvent) event = deletedEvent
  }

  loggerInfo('getSyncedEventInDB', {
    outlookEvent,
    event,
    isOutlookEventException,
    eventLatestChange,
    // deletedEvents,
    // occurrenceEvents
  })

  return event
}

const getEventLatestChange = (outlookEvent, logs = [],) => {
  const eventLog = logs.find(e => e.outlookId === outlookEvent.outlookId)

  if (!eventLog)
    return EVENT_LATEST_CHANGE.FROM_OUTLOOK

  const isOutlookEventTheLatestUpdate = moment(outlookEvent.lastModifiedDateTime)
    .isAfter(eventLog.date)

  if (isOutlookEventTheLatestUpdate)
    return EVENT_LATEST_CHANGE.FROM_OUTLOOK
  else
    return EVENT_LATEST_CHANGE.FROM_DB
}

// const getEventMostRecentModifyType = (deletedLogs, outlookEvent) => {
//   const deletedEvent = deletedLogs.find(e => e.outlookId === outlookEvent.outlookId)

//   if (deletedEvent) {
//     const isOutlookEventTheLatestUpdate = moment(outlookEvent.lastModifiedDateTime).isAfter(deletedEvent.date)
//     return isOutlookEventTheLatestUpdate
//   } else return false
// }

// sync outlook event 
const syncOutlookEvents = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.SYNCING_OUTLOOK_EVENTS
    })

    const {
      tokens,
      timeZone,
      prefixesFieldIds,
      projectPrefixes,
    } = await getOutlookSyncVarsNoClient({
      models,
      projectId,
    })

    const {
      checkboxCustomFieldsIds,
      dateCustomFieldsFound,
      dateCustomFieldsIds,
      shownDateCustomFieldIds,
    } = await getProjectCustomFields({ models, projectId })

    const aggregateOpsPrefixTitle = getAggregateOpsEventPrefixTitle({ prefixesFieldIds, projectPrefixes })

    const aggregateOpsEventDuration = getAggregateOpsEventDuration({
      projectCheckBoxFieldsIds: checkboxCustomFieldsIds,
      projectDateCustomFields: dateCustomFieldsFound
    })

    const outlookSyncAggregate = await models.OutlookSync.aggregate([
      {
        "$match": {
          _id: mongoose.Types.ObjectId(outlookSyncId)
        }
      },
      {
        "$set": {
          "singleEventsUpdatedToSync": {
            "$filter": {
              "input": "$singleEventsUpdated",
              "as": "singleEventUpdated",
              "cond": {
                $and: [
                  {
                    $not: {
                      $in: [
                        "$$singleEventUpdated.outlookId",
                        {
                          "$ifNull": [
                            "$syncedSingleEventsUpdatedOutlookIds",
                            []
                          ]
                        }
                      ]
                    }
                  },
                  // {
                  //   $eq: [
                  //     "$$singleEventUpdated.type",
                  //     OutlookEventTypes.SINGLE_INSTANCE
                  //   ]
                  // },
                ]

              }
            }
          }
        }
      },
      {
        "$set": {
          hasMoreToSync: {
            "$toBool": {
              "$gt": [
                {
                  "$size": "$singleEventsUpdatedToSync"
                },
                maxLimit
              ]
            }
          }
        }
      },
      {
        "$project": {
          hasMoreToSync: 1,
          singleEventsUpdatedToSync: {
            "$slice": [
              "$singleEventsUpdatedToSync",
              maxLimit
            ]
          },

        }
      }
    ])

    const outlookSyncFound = outlookSyncAggregate && outlookSyncAggregate[0]
    if (!outlookSyncFound) throw new ApolloError('outlook_sync_not_found')

    const singleEventsUpdated = outlookSyncFound.singleEventsUpdatedToSync || []
    const hasMoreToSync = outlookSyncFound.hasMoreToSync

    const projectCategories = await getProjectCategories({ projectId })

    const singleEventsUpdatedOutlookIds = getEventsOutlookIds(singleEventsUpdated)

    const singleEventsFound = await models.Event.find({
      projectId,
      outlookId: { $in: singleEventsUpdatedOutlookIds },
      // type: OutlookEventTypes.SINGLE_INSTANCE,
      // type: { $not: { $eq: OutlookEventTypes.OCCURRENCE } },
      // deletedAt: null,
    })

    // const nonOccurenceSyncedEventsFound = singleEventsFound.map(e => e.type !== OutlookEventTypes.OCCURRENCE)
    const syncedSingleEventsFound = singleEventsFound.filter(e => !e.deletedAt)
    const syncedDeletedEventsFound = singleEventsFound.filter(e => !!e.deletedAt)
    const syncedOccurenceEventsFound = syncedSingleEventsFound.filter(e => e.type === OutlookEventTypes.OCCURRENCE)

    const calendarEventLogsFound = await models.CalendarUpdateLog.find({
      projectId,
      action: [CalendarLogActionTypes.DELETE, CalendarLogActionTypes.UPDATE],
      outlookId: { $in: singleEventsUpdatedOutlookIds },
      synced: false
    }).sort('-date')

    // get updated events based on calendarUpdateLogs
    const updatedEventLogs = await models.CalendarUpdateLog.find({
      projectId,
      action: CalendarLogActionTypes.UPDATE,
      synced: false,
      eventId: { $ne: null }
    })

    const updatedDbEventIds = new Set(updatedEventLogs.map(l => String(l.eventId)))

    loggerInfo({ updatedDbEventIds })

    const isEventInUpdateLogs = (eventId) => updatedDbEventIds.has(String(eventId))

    const eventsToUpdateInOutlook = []

    const syncedEventsBulkUpdates = []
    const eventsToInsert = []

    const masterSeriesEventsToUpdateInDbOutlookIds = new Set()
    const syncedEventsOutlookIds = new Set()


    for (const outlookEvent of singleEventsUpdated) {

      // is there is no event found then it might be an issue or not created in db at all
      const eventFound = getSyncedEventInDB(
        syncedSingleEventsFound,
        syncedOccurenceEventsFound,
        syncedDeletedEventsFound,
        calendarEventLogsFound,
        outlookEvent
      )
      loggerInfo('eventFound', {
        eventFound,
        syncedSingleEventsFound: syncedSingleEventsFound.map(e => e._id),
        outlookEvent
      })

      if (eventFound) {
        const eventId = eventFound._id
        const isEventSeriesMaster = eventFound.type === OutlookEventTypes.SERIES_MASTER

        // check if there are differences
        const isModified = isEventModified(eventFound, outlookEvent)

        loggerInfo('event_found_in_db', { isModified, eventId, })

        if (isModified) {
          // test if what event has the most recent update 
          const latestUpdatedEvent = getLatestUpdatedEvent(eventFound, outlookEvent)
          const isEventUpdatedInDb = isEventInUpdateLogs(eventId)
          loggerInfo('event_is_modified', { eventId, isEventUpdatedInDb, latestUpdatedEvent })

          if (latestUpdatedEvent === 'event') {

            if (isEventUpdatedInDb) {
              const formattedEvent = formatUpdateEventToOutlook(eventFound, timeZone, projectCategories)
              loggerInfo('event to update in outlook: ', formattedEvent)

              if (formattedEvent) {
                const reqId = eventId

                eventsToUpdateInOutlook.push({
                  reqId,
                  outlookId: eventFound.outlookId,
                  ...formattedEvent,
                })

              }
            }

          } else if (latestUpdatedEvent === 'outlookEvent') {
            const fromOutlook = eventFound.fromOutlook;
            const isException = outlookEvent.type;
            loggerInfo('syncedEventsBulkUpdates', {
              fromOutlook,
              isException,
              outlookEvent,
              outlookEventTitle: outlookEvent.title,
              'outlookEvent.categoryId': outlookEvent.categoryId
            })
            syncedEventsBulkUpdates.push({
              updateOne: {
                filter: { _id: mongoose.Types.ObjectId(eventFound._id) },
                update: {
                  title: outlookEvent.title,
                  ...fromOutlook && isException && {
                    seriesMasterId: outlookEvent.seriesMasterId,
                  },
                  isRecurrenceEditable: outlookEvent.isRecurrenceEditable,
                  type: outlookEvent.type,
                  recurrence: outlookEvent.recurrence,
                  location: outlookEvent.location,
                  notes: outlookEvent.notes,
                  categoryId: outlookEvent.categoryId &&
                    mongoose.Types.ObjectId(outlookEvent.categoryId),
                  start: outlookEvent.start,
                  end: outlookEvent.end,

                  updatedAt: new Date(),
                  isAllDay: Boolean(outlookEvent.isAllDay),
                  showAs: outlookEvent.showAs,
                  sensitivity: outlookEvent.sensitivity,
                  deletedAt: null
                }
              }
            })

            if (isEventSeriesMaster) masterSeriesEventsToUpdateInDbOutlookIds.add(outlookEvent.outlookId)
          }
        }

      } else {
        // no events found it could mean that the event is an issue event
        // find in the db if outlookId exist on issues
        const issueAggregate = await models.Issue.aggregate([
          {
            $match: {
              projectId: mongoose.Types.ObjectId(projectId),
              'issueCustomFields.fieldId': { $in: dateCustomFieldsIds },
              'issueCustomFields.outlookId': outlookEvent.outlookId,
            },
          },
          ...aggregateOpsPrefixTitle,
          ...aggregateOpsEventDuration,
          {
            $set: {
              issueCustomFields: {
                $filter: {
                  input: "$issueCustomFields",
                  as: "issueCustomField",
                  cond: {
                    $and: [
                      { $in: ["$$issueCustomField.fieldId", dateCustomFieldsIds], },
                    ]
                  }
                },
              },
            },
          },
          { $unwind: '$issueCustomFields' },
          { $match: { "issueCustomFields.outlookId": outlookEvent.outlookId } },
        ]);

        const issueEventFound = issueAggregate && issueAggregate[0]
        loggerInfo({ issueEventFound })

        if (issueEventFound) {

          // const isEventUpdatedInDb = isEventInUpdateLogs(dbEvent._id);
          // loggerInfo('isEventUpdatedInDb', isEventUpdatedInDb)

          // check if issue event and outlook issue event have differences
          const isIssueEventModifed = getIsIssueEventModified(
            issueEventFound,
            outlookEvent,
            {
              timeZone,
              customFields: dateCustomFieldsFound,
              projectCategories
            }
          )

          const formattedEvent = formatIssueEventToOutlook(
            issueEventFound,
            timeZone,
            { customFields: dateCustomFieldsFound, projectCategories }
          )

          loggerInfo({ isIssueEventModifed, formattedEvent })


          // if issue event from outlook is has changes then update it in outlook
          if (isIssueEventModifed && formattedEvent) {
            const issueEventOutlookId = issueEventFound.issueCustomFields.outlookId

            const reqId = mongoose.Types.ObjectId()
            eventsToUpdateInOutlook.push({
              reqId,
              outlookId: issueEventOutlookId,
              ...formattedEvent,
            })

            loggerInfo({ issueEventOutlookId })

          }
        } else {

          // if event is also not delete it doesnt exist in the db so create it

          const syncedMasterEvent = getOutlookEvent(syncedSingleEventsFound, outlookEvent.seriesMasterId);
          let seriesMasterId = outlookEvent.seriesMasterId;
          let fromOutlook = true

          if (syncedMasterEvent && !syncedMasterEvent.fromOutlook) {
            seriesMasterId = syncedMasterEvent._id
            fromOutlook = false
          }

          const newEvent = {
            start: outlookEvent.start,
            end: outlookEvent.end,
            title: outlookEvent.title || ' ',
            location: outlookEvent.location,
            notes: outlookEvent.notes,
            categoryId: outlookEvent.categoryId,
            projectId,
            seriesMasterId,
            isRecurrenceEditable: outlookEvent.isRecurrenceEditable,
            type: outlookEvent.type,
            recurrence: outlookEvent.recurrence,
            createdAt: new Date(),
            isAllDay: Boolean(outlookEvent.isAllDay),
            outlookId: outlookEvent.outlookId,
            fromOutlook,
            sensitivity: outlookEvent.sensitivity,
            showAs: outlookEvent.showAs,
          }

          // look for any outlookId duplicates and if nothing found then push to eventsToInsert array
          const outlookIdExist = eventsToInsert.find(e => e.outlookId === outlookEvent.outlookId)
          loggerInfo('isEventDeletedInDbAndUpdatedInOutlook', {
            outlookIdExist: outlookIdExist,
            newEvent: newEvent
          })

          if (!outlookIdExist) eventsToInsert.push(newEvent)
        }

      }

      syncedEventsOutlookIds.add(outlookEvent.outlookId)
    }

    loggerInfo({
      eventsToInsert,
      masterSeriesEventsToUpdateInDbOutlookIds
    })

    await models.Event.bulkWrite(syncedEventsBulkUpdates)
    await models.Event.insertMany(eventsToInsert)
    // await models.CalendarUpdateLog.updateMany(
    //   {
    //     projectId,
    //     action: CalendarLogActionTypes.DELETE,
    //     synced: false,
    //     _id: { $in: [...deletedLogsIdsToUpdateSynced] }
    //   },
    //   {
    //     synced: true
    //   }
    // )

    const masterSeriesEventsToUpdateInOlOutlookIds = new Set()
    const updatedEventsIds = new Set()

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


        // for (const updatedEvent of updatedOutlookEvents) {
        const eventType = updatedEvent.type
        const outlookId = updatedEvent.outlookId
        updatedEventsIds.add(updatedEvent.resId)
        if (eventType === OutlookEventTypes.SERIES_MASTER) {
          masterSeriesEventsToUpdateInOlOutlookIds.add(outlookId)
        }
      }

      // }
    }

    if (updatedEventsIds.size > 0)
      await syncEventsInCalUpdLogs({
        _projectId: projectId,
        _outlookSyncId: outlookSyncId,
        _eventIds: [...updatedEventsIds],
        _action: CalendarLogActionTypes.UPDATE
      })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {

        status: hasMoreToSync
          ? OutlookCalendarSyncStatus.READY_TO_SYNC_OUTLOOK_EVENTS
          : OutlookCalendarSyncStatus.DONE_TO_SYNC_OUTLOOK_EVENTS,

        updatedAt: new Date(),

        $addToSet: {
          syncedSingleEventsUpdatedOutlookIds: { $each: [...syncedEventsOutlookIds] },
          masterSeriesEventsToUpdateInOlOutlookIds: { $each: [...masterSeriesEventsToUpdateInOlOutlookIds] },
          masterSeriesEventsToUpdateInDbOutlookIds: { $each: [...masterSeriesEventsToUpdateInDbOutlookIds] },
        }
      }
    );

    return outlookSyncId

  } catch (err) {
    loggerError('syncOutlookEvents ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_SYNC_OUTLOOK_EVENTS,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err

  }
}

module.exports = {
  syncOutlookEvents,
}
