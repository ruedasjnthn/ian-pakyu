const mongoose = require('mongoose');
const { OutlookEventTypes, CalendarRangeFilter } = require('../../../../constants/outlook');
const moment = require("moment");
const momentTz = require("moment-timezone");
const { allDayDateFormat, dateFormat, dateComparingFormat } = require('../../../../constants/calendar');
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, } = require('../../../../helper/OutlookSyncHelper');
const { OutlookCalendarSyncStatus, CalendarSyncLimit } = require('../../../../constants/outlook-calendar');
const { ApolloError } = require('apollo-server-express');

const maxLimit = CalendarSyncLimit.SERIES_EVENT_LIMIT

const getHasMoreOutlookEvents = (notSynced) => {
  const notSyncedLength = (notSynced || []).length

  const hasMore = notSyncedLength > maxLimit
  return hasMore
}


// sync series events 
const syncSeriesEvents = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.SYNCING_SERIES_EVENTS
    })

    const outlookSyncFound = await models.OutlookSync.findById(
      outlookSyncId,
      'events matchingEventsOutlookIds seriesMasterEvents outlookEventsResultSynced'
    )
    if (!outlookSyncFound) throw new ApolloError('outlook_sync_not_found')

    const outlookEventsResult = await (outlookSyncFound.events || [])
    const matchingEventsOutlookIds = await (outlookSyncFound.matchingEventsOutlookIds || [])
    const outlookEventsResultSynced = new Set(outlookSyncFound.outlookEventsResultSynced || [])
    const outlookSeriesMasterEvents = await outlookSyncFound.seriesMasterEvents

    // find issue events to create in outlook
    // --------------------------------------------
    // ----- CREATE EVENTS IN (DB) FROM OUTLOOK ----- 
    // --------------------------------------------
    // const outlookSyncFound = await models.OutlookSync.findById(outlookSyncId)
    // const outlookEventsResult = await outlookSyncFound.events
    // const outlookSeriesMasterEvents = await outlookSyncFound.seriesMasterEvents

    loggerInfo('>>> creating events from outlook to db...')

    const exceptionEventsFound = await models.Event.find({
      projectId,
      outlookId: null,
      type: OutlookEventTypes.EXCEPTION,
      deletedAt: null,
      $and: [
        {
          $or: [
            { archived: false },
            { archived: null },
          ],
        },
        {
          // CalendarRangeFilter is $or object
          ...CalendarRangeFilter,
        }
      ]
    })

    const outlookEventsResultNotSynced = outlookEventsResult
      .filter(e => !outlookEventsResultSynced.has(e.outlookId))

    const outlookEventsResultToSync = outlookEventsResultNotSynced
      .slice(0, maxLimit)

    const hasMoreOutlookEvents = getHasMoreOutlookEvents(outlookEventsResultNotSynced)
    loggerInfo({
      outlookEventsResultNotSyncedL: outlookEventsResultNotSynced.length,
      hasMoreOutlookEvents,
      // outlookSeriesMasterEvents
    })
    const exceptionSeriesMasterOutlookIdsInRes = outlookEventsResultToSync
      .filter(e => e.type === OutlookEventTypes.EXCEPTION)
      .map(e => e.seriesMasterId)

    const seriesMasterEventsFound = await models.Event.find({
      projectId,
      outlookId: {
        $ne: null,
        $in: exceptionSeriesMasterOutlookIdsInRes
      },
      type: OutlookEventTypes.SERIES_MASTER,
      deletedAt: null,
      $or: [
        { archived: false },
        { archived: null },
      ],
    })

    // loggerInfo({
    //   outlookEventsResultToSync,
    //   exceptionSeriesMasterOutlookIdsInRes,
    //   seriesMasterEventsFound
    // })

    const outlookEventsToSave = [];
    const duplicates = [];
    const exceptionEventsUpdateBulkOps = []

    const matchedExceptionEventIds = new Set
    const outlookEventsSynced = new Set()

    for (const event of outlookEventsResultToSync) {
      outlookEventsSynced.add(event.outlookId)

      const isOccurenceEvent = event.type === OutlookEventTypes.OCCURRENCE
      const isExceptionEvent = event.type === OutlookEventTypes.EXCEPTION
      const masterEvent = isOccurenceEvent || isExceptionEvent
        ? await outlookSeriesMasterEvents.find(e => e.outlookId === event.seriesMasterId)
        : null

      // check if event has a duplicate and already updated
      const hasEventAlreadyMerged = matchingEventsOutlookIds.includes(event.outlookId)
      // check if the series master event has matchong event in outlook
      const hasMasterEventAlreadyMerged = masterEvent && matchingEventsOutlookIds.includes(masterEvent.outlookId)

      if (!hasEventAlreadyMerged) {

        // look for any outlookId duplicates and if nothing found then push to eventsToInsert array
        const existingOutlookId = outlookEventsToSave.find(outlookEvent =>
          outlookEvent.outlookId === event.outlookId)

        if (existingOutlookId) duplicates.push(event.outlookId)
        else {

          let eventToSave = null

          if (isOccurenceEvent) {

            if (masterEvent && !hasMasterEventAlreadyMerged) {
              eventToSave = {
                start: event.start,
                end: event.end,
                // start: event.start + 'Z',
                // end: event.end + 'Z',

                seriesMasterId: event.seriesMasterId,
                outlookId: event.outlookId,
                type: event.type,
                recurrence: event.recurrence,
                projectId,
                fromOutlook: true,
                createdAt: new Date(),

                title: masterEvent.title || ' ',
                location: masterEvent.location,
                notes: masterEvent.notes,
                isAllDay: Boolean(masterEvent.isAllDay),
                categoryId: masterEvent.categoryId,
                isRecurrenceEditable: masterEvent.isRecurrenceEditable,

                showAs: masterEvent.showAs,
                sensitivity: masterEvent.sensitivity
              }
            } else {
              loggerInfo('no master event', event)
            }

          } else if (isExceptionEvent) {

            const exceptionMasterEvent = event.outlookId &&
              seriesMasterEventsFound.find(me => me.outlookId === event.seriesMasterId)

            const matchingOutlookEventsList = exceptionEventsFound.filter(exceptionEvent => {
              const isTitleSame = exceptionEvent.title === event.title
              const isSameIsAllDay = Boolean(exceptionEvent.isAllDay) === Boolean(event.isAllDay)
              const isTypeSame = exceptionEvent.type === event.type
              const isMasterSeriesSame = exceptionMasterEvent && exceptionMasterEvent.outlookId === event.seriesMasterId
              // let isStartDateSame = false
              // let isEndDateSame = false

              let isFieldValuesSame = isTitleSame && isSameIsAllDay && isTypeSame && isMasterSeriesSame
              loggerInfo('isFieldValuesSame', {
                'event.outlookId': event.outlookId,
                exceptionMasterEvent,
                isFieldValuesSame,
                isTitleSame,
                isSameIsAllDay,
                isTypeSame,
                isMasterSeriesSame,
              })
              if (!isFieldValuesSame) return false;

              const dateTimeFormat = Boolean(exceptionEvent.isAllDay) ? allDayDateFormat : dateComparingFormat
              const exceptionEventStartString = String(exceptionEvent.start)
              const exceptionEventEndString = String(exceptionEvent.end)
              const eventStartString = String(event.start)
              const eventEndString = String(event.end)

              const eventStart = moment(eventStartString).format(dateFormat)
              const eventEnd = moment(eventEndString).format(dateFormat)

              const oeStart = momentTz(exceptionEventStartString).tz('UTC').format(dateTimeFormat);
              const aeStart = momentTz(eventStart).tz('UTC').format(dateTimeFormat);
              // const aeStart = momentTz(eventStart).tz(timeZone).format(dateTimeFormat);
              const isStartDateSame = moment(oeStart).isSame(aeStart);

              const oeEnd = momentTz(exceptionEventEndString).tz('UTC').format(dateTimeFormat);
              const aeEnd = momentTz(eventEnd).tz('UTC').format(dateTimeFormat);
              // const aeEnd = momentTz(eventEnd).tz(timeZone).format(dateTimeFormat);
              const isEndDateSame = moment(oeEnd).isSame(aeEnd);

              loggerInfo('isTitleSame', exceptionEvent.title, {
                // 'outlookEvent.start': outlookEvent.start,
                // "event.start": event.start,
                outlookEventStartString: exceptionEventStartString,
                eventStartString,
                oeStart,
                aeStart,
                isStartDateSame,
                isEndDateSame,
              })
              isFieldValuesSame = isStartDateSame && isEndDateSame
              return isFieldValuesSame

            })
            const sortedMatchingOutlookEventsList = [...matchingOutlookEventsList.sort((a, b) => {
              return new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime);
            })]
            const matchingEvent = sortedMatchingOutlookEventsList[0]

            loggerInfo({
              matchingEvent,
              event
            })
            if (matchingEvent) {
              exceptionEventsUpdateBulkOps.push({
                updateOne: {
                  filter: { _id: mongoose.Types.ObjectId(matchingEvent._id) },
                  update: {
                    outlookId: event.outlookId,
                    categoryId: event.categoryId,
                    updatedAt: new Date()
                  }
                }
              })
              matchedExceptionEventIds.add(matchingEvent._id)
            } else {
              eventToSave = {
                title: event.title || ' ',
                start: event.start,
                end: event.end,
                projectId,
                fromOutlook: true,
                createdAt: new Date(),
                location: event.location,
                notes: event.notes,
                isAllDay: Boolean(event.isAllDay),
                outlookId: event.outlookId,
                categoryId: event.categoryId,
                seriesMasterId: event.seriesMasterId,
                type: event.type,
                recurrence: event.recurrence,
                isRecurrenceEditable: event.isRecurrenceEditable,
                showAs: event.showAs,
                sensitivity: event.sensitivity
              }
            }

          } else {

            // creates events from outlook singleInstance and whatnot
            eventToSave = {
              title: event.title || ' ',
              start: event.start,
              end: event.end,
              projectId,
              fromOutlook: true,
              createdAt: new Date(),
              location: event.location,
              notes: event.notes,
              isAllDay: Boolean(event.isAllDay),
              outlookId: event.outlookId,
              categoryId: event.categoryId,
              seriesMasterId: event.seriesMasterId,
              type: event.type,
              recurrence: event.recurrence,
              isRecurrenceEditable: event.isRecurrenceEditable,
              showAs: event.showAs,
              sensitivity: event.sensitivity
            }
          }

          if (eventToSave !== null) {
            outlookEventsToSave.push(eventToSave)
          }
        }
      }
    }

    loggerInfo({ duplicatesLength: duplicates.length })
    // -----------------------------------
    // --- create outlook events to (DB) ---
    await models.Event.insertMany(outlookEventsToSave)
    await models.Event.bulkWrite(exceptionEventsUpdateBulkOps)
    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: hasMoreOutlookEvents
          ? OutlookCalendarSyncStatus.READY_TO_SYNC_SERIES_EVENTS
          : OutlookCalendarSyncStatus.DONE_TO_SYNC_SERIES_EVENTS,
        updatedAt: new Date(),
        $addToSet: {
          outlookEventsResultSynced: { $each: [...outlookEventsSynced] },
          matchedExceptionEventIds: { $each: [...matchedExceptionEventIds] },
        }
      }
    );

    return outlookSyncId

  } catch (err) {
    loggerError('syncSeriesEvents ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_SYNC_SERIES_EVENTS,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err
  }
}

module.exports = {
  syncSeriesEvents,
}
