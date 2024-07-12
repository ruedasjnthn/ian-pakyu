const { createOutlookEventsPerBatch, } = require('../../../../helper/OutlookEventHelper');
const mongoose = require('mongoose');
const { OutlookEventTypes, CalendarSyncRange, RecurrenceRangeType, CalendarRangeFilter } = require('../../../../constants/outlook');
const { formatEventToOutlook, } = require('../../../../helper/EventHelper');
const moment = require("moment");
const momentTz = require("moment-timezone");
const { allDayDateFormat, dateFormat, dateComparingFormat } = require('../../../../constants/calendar');
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, getOutlookSyncVars } = require('../../../../helper/OutlookSyncHelper');
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

  loggerInfo({
    seriesMasterEventsInRange: seriesMasterEventsInRange,
    // seriesMasterEventsInRange: JSON.stringify(seriesMasterEventsInRange),
  })

  return {
    seriesMasterEventOutlookIdsInRange: [...seriesMasterEventOutlookIdsInRange],
    seriesMasterEventObjectIdsInRange: [...seriesMasterEventObjectIdsInRange],
  }
}

// sync issues 
const syncEvents = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.SYNCING_EVENTS
    })

    const {
      client,
      outlookCalendarId,
      timeZone,
    } = await getOutlookSyncVars({
      models,
      projectId,
    })

    const outlookSyncFound = await models.OutlookSync.findById(
      outlookSyncId,
      'events syncedEventsIds'
    )
    const outlookEventsResult = await (outlookSyncFound.events || [])
    const eventsIdsAlreadySynced = await (outlookSyncFound.syncedEventsIds || [])

    const projectCategories = await getProjectCategories({ projectId })

    const excludedCategoriesIds = getExcludedInSyncCategories({ projectCategories, projectId })

    loggerInfo('createEventsInOutlook', { projectCategories, excludedCategoriesIds })

    const {
      seriesMasterEventObjectIdsInRange,
      seriesMasterEventOutlookIdsInRange,
    } = await getSeriesMastersInRange({
      models,
      projectId,
      excludedCategoriesIds
    })

    const eventsFilter = {
      projectId,
      outlookId: null,
      deletedAt: null,
      archived: { $ne: true },
      _id: { $nin: eventsIdsAlreadySynced },
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

    const eventsUpdateBulkOps = []
    const eventsToCreateInOutlook = []

    const createdSeriesMasterOutlookIds = new Set()
    const matchingEventsOutlookIds = new Set()

    loggerInfo({
      // eventsIdsAlreadySynced: JSON.stringify(eventsIdsAlreadySynced),
      eventsFilter: JSON.stringify(eventsFilter),
      // eventsFound,
      seriesMasterEventObjectIdsInRange,
      seriesMasterEventOutlookIdsInRange,
    })

    for (const event of eventsFound) {
      const eventId = event._id
      const formattedEvent = formatEventToOutlook(event, timeZone, projectCategories);

      if (!formattedEvent) loggerInfo('formattedEvent is null')
      else {
        // check if there are matching events in outlook
        const matchingOutlookEventsList = outlookEventsResult.filter(outlookEvent => {
          const isTitleSame = outlookEvent.title === event.title
          const isSameIsAllDay = Boolean(outlookEvent.isAllDay) === Boolean(event.isAllDay)
          const isTypeSame = outlookEvent.type === event.type
          const isSeriesMasterEvent = outlookEvent.type === OutlookEventTypes.SERIES_MASTER
          const isSingleInstanceEvent = ![OutlookEventTypes.OCCURRENCE, OutlookEventTypes.EXCEPTION]
            .includes(event.type)
          // let isStartDateSame = false
          // let isEndDateSame = false

          let isFieldValuesSame = isTitleSame && isSameIsAllDay && isTypeSame
          if (!isFieldValuesSame) return false;

          if (isSeriesMasterEvent) {

            const { pattern: outlookEventPattern, range: outlookEventRange } = outlookEvent.recurrence
            const { pattern: eventPattern, range: eventRange } = event.recurrence
            // loggerInfo('formatEventToOutlook', {
            //   outlookEventPattern,
            //   eventPattern,
            //   outlookEventRange,
            //   eventRange,
            // })

            const isRecurrenceTypeSame = outlookEventPattern.type === eventPattern.type
            const isIntervalSame = outlookEventPattern.interval === eventPattern.interval
            const isMonthSame = outlookEventPattern.month === eventPattern.month
            const isDayOfMonthSame = outlookEventPattern.dayOfMonth === eventPattern.dayOfMonth
            const isDaysOfWeekSame = outlookEventPattern.daysOfWeek === eventPattern.daysOfWeek
            const isFirstDayOfWeekSame = outlookEventPattern.firstDayOfWeek === eventPattern.firstDayOfWeek
            const isIndexSame = outlookEventPattern.index === eventPattern.index

            const isPatternFieldValuesSame =
              isRecurrenceTypeSame &&
              isIntervalSame &&
              isMonthSame &&
              // isDayOfMonthSame &&
              // isDaysOfWeekSame &&
              isFirstDayOfWeekSame &&
              isIndexSame

            const isRangeTypeSame = outlookEventRange.type === eventRange.type
            const isRangeStartDateSame = outlookEventRange.startDate === eventRange.startDate
            const isRangeEndDateSame = outlookEventRange.endDate === eventRange.endDate
            const isNumberOfOccurrencesSame = outlookEventRange.numberOfOccurrences === eventRange.numberOfOccurrences

            const isRangeFieldValuesSame =
              isRangeTypeSame &&
              isRangeStartDateSame &&
              isRangeEndDateSame &&
              isNumberOfOccurrencesSame

            isFieldValuesSame = isPatternFieldValuesSame && isRangeFieldValuesSame

            loggerInfo('isSeriesMasterEvent', event.title, {
              isFieldValuesSame,
              isPatternFieldValuesSame,
              isRangeFieldValuesSame,
            })

            return isFieldValuesSame
          }

          else if (isSingleInstanceEvent) {
            const dateTimeFormat = outlookEvent.isAllDay ? allDayDateFormat : dateComparingFormat
            const outlookEventStartString = String(outlookEvent.start)
            const outlookEventEndString = String(outlookEvent.end)
            const eventStartString = String(event.start)
            const eventEndString = String(event.end)

            const eventStart = moment(eventStartString).format(dateFormat)
            const eventEnd = moment(eventEndString).format(dateFormat)

            const oeStart = momentTz(outlookEventStartString).tz('UTC').format(dateTimeFormat);
            // const oeStart = momentTz(outlookEventStartString).tz(timeZone).format(dateTimeFormat);
            const aeStart = momentTz(eventStart).tz('UTC').format(dateTimeFormat);
            const isStartDateSame = moment(oeStart).isSame(aeStart);

            const oeEnd = momentTz(outlookEventEndString).tz('UTC').format(dateTimeFormat);
            // const oeEnd = momentTz(outlookEventEndString).tz(timeZone).format(dateTimeFormat);
            const aeEnd = momentTz(eventEnd).tz('UTC').format(dateTimeFormat);
            const isEndDateSame = moment(oeEnd).isSame(aeEnd);

            const aktenplatzEventStartTestTimezone = momentTz(eventStart).tz(timeZone).format(dateTimeFormat);
            const aktenplatzEventStartTestUTC = momentTz(eventStart).tz("UTC").format(dateTimeFormat);

            loggerInfo('hasAMatchingEvent', outlookEvent.title, {
              aktenplatzEventStartTestTimezone,
              aktenplatzEventStartTestUTC,
              outlookEventStartString,
              eventStartString,
              oeStart,
              aeStart,
              isStartDateSame,
              isEndDateSame,
            })
            isFieldValuesSame = isStartDateSame && isEndDateSame
            return isFieldValuesSame
          }

          return isFieldValuesSame

        })

        const sortedMatchingOutlookEventsList = [...matchingOutlookEventsList.sort((a, b) => {
          return new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime);
        })]
        const matchingEvent = sortedMatchingOutlookEventsList[0]

        loggerInfo({
          matchingEvent
        })

        if (matchingEvent) {
          eventsUpdateBulkOps.push({
            updateOne: {
              filter: { _id: mongoose.Types.ObjectId(event._id) },
              update: {
                outlookId: matchingEvent.outlookId,
                // categoryId: matchingEvent.categoryId,
                updatedAt: new Date(),
                ...!(event.type) && { type: OutlookEventTypes.SINGLE_INSTANCE },
              }
            }
          })

          loggerInfo({
            matchingEvent,
            matchingEventCategoryId: matchingEvent.categoryId,
          })

          matchingEventsOutlookIds.add(matchingEvent.outlookId)

          if (matchingEvent.type === OutlookEventTypes.SERIES_MASTER) {
            createdSeriesMasterOutlookIds.add(matchingEvent.outlookId)
          }

        } else {
          // else if no matching outlook event

          const reqId = mongoose.Types.ObjectId(eventId)

          eventsToCreateInOutlook.push({
            reqId,
            ...formattedEvent
          })

        }

      }
    }


    const createdEvents = await createOutlookEventsPerBatch(
      client,
      eventsToCreateInOutlook,
      outlookCalendarId,
      projectCategories
    )

    const syncedEventsIds = new Set()
    const createdOutlookIds = new Set()

    for (const createdEvent of createdEvents) {
      const eventId = createdEvent.resId

      syncedEventsIds.add(eventId)
      createdOutlookIds.add(createdEvent.outlookId)

      eventsUpdateBulkOps.push({
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
      // eventsUpdateBulkOps: JSON.stringify(eventsUpdateBulkOps),
      // eventsToCreateInOutlook: JSON.stringify(eventsToCreateInOutlook),
      createdOutlookIds,
      createdSeriesMasterOutlookIds,
    })

    await models.Event.bulkWrite(eventsUpdateBulkOps);

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: hasMoreEvents
          ? OutlookCalendarSyncStatus.READY_TO_SYNC_EVENTS
          : OutlookCalendarSyncStatus.DONE_TO_SYNC_EVENTS,
        updatedAt: new Date(),
        $addToSet: {
          recentlyCreatedEventsOutlookIds: { $each: [...createdOutlookIds] },
          recentlyCreatedSeriesMasterEventsOutlookIds: { $each: [...createdSeriesMasterOutlookIds] },
          matchingEventsOutlookIds: { $each: [...matchingEventsOutlookIds] },
          syncedEventsIds: { $each: [...syncedEventsIds] },
        }
      }
    );

    return outlookSyncId

  } catch (err) {
    loggerError('syncEvents ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_SYNC_EVENTS,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err

  }
}

module.exports = {
  syncEvents,
}
