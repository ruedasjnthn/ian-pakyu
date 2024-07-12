const { getClientWithUpdateToken } = require('../../../helper/AuthHelper');
const { batchCreateCalendarEvent, deleteOutlookEvents20PerBatch, batchUpdateOutlookEvent } = require('../../../helper/OutlookEventHelper');
const mongoose = require('mongoose');
const { OutlookSyncStatusTypes, OutlookEventTypes, RecurrenceRangeType, CalendarSyncRange } = require('../../../constants/outlook');
const { getAggregateOpsEventPrefixTitle, formatEventToOutlook, formatIssueEventToOutlook, getAggregateOpsEventDuration, } = require('../../../helper/EventHelper');
const { Event, Issue, OutlookSync } = require('../../../models');
const moment = require("moment");
const momentTz = require("moment-timezone");
const { isEventOutOfRange } = require('../../../helper/SyncHelper');
const { saveOutlookIdsOfOccurrenceEvents } = require('./sync-occurence');
const { getProjectCategories } = require('../../../helper/CategoryHelper');
const { allDayDateFormat, dateFormat, dateComparingFormat } = require('../../../constants/calendar');
const { loggerInfo, loggerError } = require('../../../config/logger');

const    createEventsInOutlook = async ({
  client,
  projectId,
  timeZone,
  projectCategories,
  outlookCalendarId,
  outlookSyncId,
  outlookEventsResult,
  addToMatchingEventsOutlookIds
}) => {
  // ----- create events in outlook ---
  loggerInfo('>>> creating events from db to outlook...')

  const startDateTime = CalendarSyncRange.getStart()
  const endDateTime =  CalendarSyncRange.getEnd()
  // const startDateTime = moment().subtract(1, 'year').startOf('year').toDate();
  // const endDateTime = moment().add(2, 'year').endOf('year').toDate();

  loggerInfo('createEventsInOutlook', {
    startDateTime,
    endDateTime,
  })

  const seriesMasterEventsInRange = await Event.aggregate([
    {
      $match: {
        projectId: mongoose.Types.ObjectId(projectId),
        type: { $in: [OutlookEventTypes.OCCURRENCE, OutlookEventTypes.EXCEPTION] },
        deletedAt: null,
        archived: { $ne: true },
        $or: [
          {
            $and: [
              { start: { $gte: startDateTime } },
              { start: { $lte: endDateTime } },
            ],
          },
          {
            $and: [
              { end: { $gte: startDateTime } },
              { end: { $lte: endDateTime } },
            ],
          },
          {
            $and: [
              { start: { $lte: startDateTime } },
              { end: { $gte: endDateTime } },
            ],
          },
        ]
      }
    },
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

  const seriesMasterEventOutlookIdsInRange = seriesMasterEventsInRange
    .filter(e => e.seriesMasterOutlookId)
    .map(e => e.seriesMasterOutlookId)

  const seriesMasterEventObjectIdsInRange = seriesMasterEventsInRange
    .filter(e => e.seriesMasterObjectId)
    .map(e => mongoose.Types.ObjectId(e.seriesMasterObjectId))

  const eventFilter = {
    projectId,
    outlookId: null,
    deletedAt: null,
    archived: { $ne: true },

    $or: [
      // for single events
      {
        type: OutlookEventTypes.SINGLE_INSTANCE,
        $or: [
          {
            $and: [
              { start: { $gte: startDateTime } },
              { start: { $lte: endDateTime } },
            ],
          },
          {
            $and: [
              { end: { $gte: startDateTime } },
              { end: { $lte: endDateTime } },
            ],
          },
          {
            $and: [
              { start: { $lte: startDateTime } },
              { end: { $gte: endDateTime } },
            ],
          },
        ]
      },
      // for series master events events
      {
        type: OutlookEventTypes.SERIES_MASTER,
        $or: [
          { _id: { $in: seriesMasterEventObjectIdsInRange } },
          { outlookId: { $in: seriesMasterEventOutlookIdsInRange } },
          { "recurrence.range.type": RecurrenceRangeType.NO_END }
        ]
      },
    ],

  }

  const eventsCount = await Event.count(eventFilter)
  const eventLimit = 1000;
  let createEventCount = 0;
  let createEventPage = 0;

  while (createEventCount < eventsCount) {
    const eventsUpdateBulkOps = []
    const eventsToCreateInOutlook = []
    const eventsReqIdObjId = []

    const createdOutlookIds = []

    const createdSeriesMasterOutlookIds = []

    const eventsFound = await Event.find(eventFilter)
      .skip(createEventPage * eventLimit)
      .limit(eventLimit)

    for (const event of eventsFound) {
      createEventCount += 1
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
            loggerInfo('formatEventToOutlook', {
              outlookEventPattern,
              eventPattern,
              outlookEventRange,
              eventRange,
            })

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
              filter: { _id: mongoose.Types.ObjectId(event.id) },
              update: {
                outlookId: matchingEvent.outlookId,
                // categoryId: matchingEvent.categoryId,
                updatedAt: new Date()
              }
            }
          })
          loggerInfo({
            matchingEvent,
            matchingEventCategoryId: matchingEvent.categoryId,
          })
          addToMatchingEventsOutlookIds(matchingEvent.outlookId)
          if (matchingEvent.type === OutlookEventTypes.SERIES_MASTER)
            createdSeriesMasterOutlookIds.push(matchingEvent.outlookId)
        } else {
          // else if no matching event

          const reqId = mongoose.Types.ObjectId()

          eventsToCreateInOutlook.push({
            reqId,
            ...formattedEvent
          })

          // for identifying purposes to get Ids an
          eventsReqIdObjId.push({
            reqId,
            // object id is eventId
            eventId: event.id,
          })



          // else if no matching event
          // const createdEvent = await createCalendarEvent(
          //   client,
          //   formattedEvent,
          //   outlookCalendarId,
          //   projectCategories
          // );

          // loggerInfo('createdEvent', createdEvent)

          // if (createdEvent) {
          //   createdOutlookIds.push(createdEvent.outlookId)
          //   eventsUpdateBulkOps.push({
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
    }


    const batch20Events = {};

    let batchCount = 1;
    let count = 1;
    for (const event of eventsToCreateInOutlook) {
      batch20Events[batchCount] = [...batch20Events[batchCount] || [], event];

      if (count === 20) {
        count = 1;
        batchCount += 1;
      } else count += 1;
    }


    for (const batchNumber in batch20Events) {
      const eventBatch = batch20Events[batchNumber]
      const createdEvents = await batchCreateCalendarEvent(
        client,
        outlookCalendarId,
        eventBatch,
        projectCategories
      )

      for (const createdEvent of createdEvents) {
        // resId is equal reqId
        const eventReqIdObjId = eventsReqIdObjId.find(e => String(e.reqId) === String(createdEvent.resId))
        if (!eventReqIdObjId) loggerError('eventReqIdObjId is null', createdEvent.resId)
        else {

          createdOutlookIds.push(createdEvent.outlookId)
          eventsUpdateBulkOps.push({
            updateOne: {
              filter: { _id: mongoose.Types.ObjectId(eventReqIdObjId.eventId) },
              update: { outlookId: createdEvent.outlookId, updatedAt: new Date() }
            }
          })

          if (createdEvent.type === OutlookEventTypes.SERIES_MASTER)
            createdSeriesMasterOutlookIds.push(createdEvent.outlookId)
        }
      }
    }

    loggerInfo({
      eventsUpdateBulkOps: JSON.stringify(eventsUpdateBulkOps),
      batch20Events: JSON.stringify(batch20Events),
      eventsToCreateInOutlook: JSON.stringify(eventsToCreateInOutlook),
      createdOutlookIds,
      createdSeriesMasterOutlookIds,
    })
    await Event.bulkWrite(eventsUpdateBulkOps);
    await OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        $addToSet: {
          recentlyCreatedEventsOutlookIds: { $each: createdOutlookIds },
          recentlyCreatedSeriesMasterEventsOutlookIds: { $each: createdSeriesMasterOutlookIds },
        }
      }
    );

    createEventPage += 1;
  }
}


const createIssueEvents = async ({
  aggregateOpsPrefixTitle,
  aggregateOpsEventDuration,
  dateCustomFieldsIds,
  projectId,
  timeZone,
  client,
  outlookCalendarId,
  outlookSyncId,
  projectCategories,
  customFields,
  outlookEventsResult,
  addToMatchingEventsOutlookIds,
  hiddenDateCustomFieldsIds
}) => {
  loggerInfo('>>> creating issue events to outlook...')

  const shownDateCustomFieldIds = dateCustomFieldsIds.filter(dcfId =>
    !hiddenDateCustomFieldsIds.find(hdcfId => String(dcfId) === String(hdcfId)))

  loggerInfo({ shownDateCustomFieldIds })

  // find issue events to create in outlook
  const issueEventsFound = await Issue.aggregate([
    {
      $match: {
        projectId: mongoose.Types.ObjectId(projectId),
        archived: { $not: { $eq: true } },
        deletedAt: null,
        'issueCustomFields.fieldId': { $in: shownDateCustomFieldIds },
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
                { $in: ["$$issueCustomField.fieldId", shownDateCustomFieldIds], },
              ]
            }
          },
        },
      },
    },
    { $unwind: '$issueCustomFields' },
    { $match: { "issueCustomFields.outlookId": null, "issueCustomFields.value": { $not: { $eq: null } } }, },
  ]);

  loggerInfo({
    issueEventsFound: issueEventsFound.length,
    issueEventsFound: JSON.stringify(issueEventsFound)
  })

  const issueEventsParts = {}
  const issueEventsLimit = 1000
  const issueEventsPages = Math.ceil(issueEventsFound.length / issueEventsLimit)

  for (let i = 0; i < issueEventsPages; i += 1) {
    const start = i * issueEventsLimit;
    const end = start + issueEventsLimit
    issueEventsParts[i] = issueEventsFound.slice(start, end)
  }

  loggerInfo('issueEvents', { issueEventsParts, customFields, outlookEventsResult })
  const duplicateIssueEventOutlookIdsInOutlookToDelete = []

  // ------------------------------------------------
  // ---- create issue event in (outlook and update in db) ----
  for (const key in issueEventsParts) {
    if (key && issueEventsParts[key]) {
      const issueEventsUpdateBulkOps = []
      const issueEventsToCreateInOutlook = []
      const issueEventsToUpdateInOutlook = []
      const issueEventsResIdIssueFieldId = []
      const createdOutlookIds = []

      for (const issueEvent of issueEventsParts[key]) {
        const formattedEvent = formatIssueEventToOutlook(
          issueEvent,
          timeZone,
          { customFields, projectCategories }
        );

        loggerInfo('issueEvents formattedEvent', formattedEvent)

        if (formattedEvent) {

          const isOutsideRange = isEventOutOfRange({
            eventStartDate: formattedEvent.start.dateTime,
            timeZone
          });

          if (!isOutsideRange) {

            // check if there are matching events in outlook
            const matchingOutlookEventsList = outlookEventsResult.filter(outlookEvent => {
              const outlookEventCategoryId = outlookEvent.categoryId
              loggerInfo(issueEvent.title, { outlookEventCategoryId })
              // const isTitleSame = outlookEvent.title === issueEvent.title
              const categoryCustomField = customFields.find(cf =>
                String(cf.categoryId) === String(outlookEventCategoryId))
              const isCategorySame = categoryCustomField && String(categoryCustomField.id) === String(issueEvent.issueCustomFields.fieldId)
              const isIsAllDaySame = Boolean(outlookEvent.isAllDay) === Boolean(issueEvent.issueCustomFields.isAllDay)
              const isSingleInstanceEvent = outlookEvent.type === OutlookEventTypes.SINGLE_INSTANCE
              // let isStartDateSame = false
              // let isEndDateSame = false

              let isFieldValuesSame = isCategorySame && isIsAllDaySame
              loggerInfo(issueEvent.title, {
                categoryCustomField, isFieldValuesSame, isCategorySame
              })

              if (!isFieldValuesSame) return false;

              if (isSingleInstanceEvent) {
                const dateTimeFormat = Boolean(outlookEvent.isAllDay) ? allDayDateFormat : dateComparingFormat
                const outlookEventStartString = String(outlookEvent.start)
                const outlookEventEndString = String(outlookEvent.end)
                const eventStartString = String(formattedEvent.start.dateTime)
                const eventEndString = String(formattedEvent.end.dateTime)

                const eventStart = moment(eventStartString).format(dateFormat)
                const eventEnd = moment(eventEndString).format(dateFormat)

                const oeStart = momentTz(outlookEventStartString).tz(timeZone).format(dateTimeFormat);
                const aeStart = momentTz(eventStart).tz('UTC').format(dateTimeFormat);
                const isStartDateSame = moment(oeStart).isSame(aeStart);

                const oeEnd = momentTz(outlookEventEndString).tz(timeZone).format(dateTimeFormat);
                const aeEnd = momentTz(eventEnd).tz('UTC').format(dateTimeFormat);
                const isEndDateSame = moment(oeEnd).isSame(aeEnd);

                loggerInfo('isFieldValuesSame', outlookEvent.title, {
                  // 'outlookEvent.start': outlookEvent.start,
                  // "issueEvent.start": event.start,
                  outlookEventStartString,
                  eventStartString,
                  oeStart,
                  aeStart,
                  oeEnd,
                  aeEnd,
                  isStartDateSame,
                  isEndDateSame,
                })
                isFieldValuesSame = isStartDateSame && isEndDateSame
                return isFieldValuesSame
              }
            })

            const sortedMatchingOutlookEventsList = [...matchingOutlookEventsList.sort((a, b) => {
              return new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime);
            })]
            const matchingEvent = sortedMatchingOutlookEventsList[0]

            for (const matchingEventItem of sortedMatchingOutlookEventsList) {
              const isLatestEventMatching = matchingEventItem.outlookId === matchingEvent.outlookId
              const isTitleMatching = matchingEventItem.title === issueEvent.titleWithPrefix
              loggerInfo({
                isTitleMatching,
                'matchingEventItem.title': matchingEventItem.title,
                'issueEvent.title': issueEvent.title
              })
              if (!isLatestEventMatching && isTitleMatching) {
                duplicateIssueEventOutlookIdsInOutlookToDelete.push(matchingEventItem.outlookId)
                addToMatchingEventsOutlookIds(matchingEventItem.outlookId)
              }
            }

            loggerInfo({
              matchingEvent,
            })

            if (matchingEvent) {
              addToMatchingEventsOutlookIds(matchingEvent.outlookId)

              issueEventsUpdateBulkOps.push({
                updateOne: {
                  filter: {
                    _id: mongoose.Types.ObjectId(issueEvent._id),
                    'issueCustomFields.fieldId': mongoose.Types.ObjectId(issueEvent.issueCustomFields.fieldId)
                  },
                  update: {
                    '$set': {
                      'issueCustomFields.$.outlookId': matchingEvent.outlookId,
                    },
                  }
                }
              })

              const formattedEvent = formatIssueEventToOutlook(
                issueEvent,
                timeZone,
                { customFields, projectCategories }
              )
              loggerInfo({ formattedEvent })
              // if (formattedEvent) {

              //   const updatedIssueEventInOl = await updateOutlookEvent(
              //     client,
              //     matchingEvent.outlookId,
              //     formattedEvent,
              //     projectCategories
              //   )

              //   loggerInfo({ updatedIssueEventInOl })

              // }
              if (formattedEvent) {

                const reqId = mongoose.Types.ObjectId()
                const matchingEventOutlookId = matchingEvent.outlookId

                issueEventsToUpdateInOutlook.push({
                  reqId,
                  outlookId: matchingEventOutlookId,
                  ...formattedEvent
                })

                issueEventsResIdIssueFieldId.push({
                  reqId,
                  outlookId: matchingEventOutlookId,
                  issueId: issueEvent._id,
                  fieldId: issueEvent.issueCustomFields.fieldId,
                })

              }



            } else {
              // else if no matching event create in outlook

              const reqId = mongoose.Types.ObjectId()

              issueEventsToCreateInOutlook.push({
                reqId,
                ...formattedEvent
              })

              issueEventsResIdIssueFieldId.push({
                reqId,
                issueId: issueEvent._id,
                fieldId: issueEvent.issueCustomFields.fieldId,
              })

              // const createdEvent = await createCalendarEvent(
              //   client,
              //   formattedEvent,
              //   outlookCalendarId,
              //   projectCategories
              // );
              // loggerInfo('issueEvents createdEvent', createdEvent)

              // if (createdEvent) {
              //   createdOutlookIds.push(createdEvent.outlookId)
              //   issueEventsUpdateBulkOps.push({
              //     updateOne: {
              //       filter: {
              //         _id: mongoose.Types.ObjectId(issueEvent._id),
              //         'issueCustomFields.fieldId': mongoose.Types.ObjectId(issueEvent.issueCustomFields.fieldId)
              //       },
              //       update: {
              //         '$set': {
              //           'issueCustomFields.$.outlookId': createdEvent.outlookId,
              //         },
              //       }
              //     }
              //   })
              // }
            }

          }
        }
      }

      const batch20Events = {};

      let batchCount = 1;
      let count = 1;
      for (const issueEvent of issueEventsToCreateInOutlook) {
        batch20Events[batchCount] = [...batch20Events[batchCount] || [], issueEvent];

        if (count === 20) {
          count = 1;
          batchCount += 1;
        } else count += 1;
      }


      for (const batchNumber in batch20Events) {
        const eventBatch = batch20Events[batchNumber]
        const createdEvents = await batchCreateCalendarEvent(
          client,
          outlookCalendarId,
          eventBatch,
          projectCategories
        )

        for (const createdEvent of createdEvents) {
          const issueEventResIdIssueFieldId = issueEventsResIdIssueFieldId.find(e => String(e.reqId) === String(createdEvent.resId))
          if (!issueEventResIdIssueFieldId) loggerError('issueEventResIdIssueFieldId is null', createdEvent.resId)
          else {
            createdOutlookIds.push(createdEvent.outlookId)
            issueEventsUpdateBulkOps.push({
              updateOne: {
                filter: {
                  _id: mongoose.Types.ObjectId(issueEventResIdIssueFieldId.issueId),
                  'issueCustomFields.fieldId': mongoose.Types.ObjectId(issueEventResIdIssueFieldId.fieldId)
                },
                update: {
                  '$set': {
                    'issueCustomFields.$.outlookId': createdEvent.outlookId,
                  },
                }
              }
            })
          }
        }
      }

      const updateBatch20IssueEvents = {};

      let updateBatchCount = 1;
      let updateCount = 1;
      for (const issueEvent of issueEventsToUpdateInOutlook) {
        updateBatch20IssueEvents[updateBatchCount] =
          [...updateBatch20IssueEvents[updateBatchCount] || [], issueEvent];

        if (updateCount === 20) {
          updateCount = 1;
          updateBatchCount += 1;
        } else updateCount += 1;
      }


      for (const batchNumber in updateBatch20IssueEvents) {
        const issueEventBatch = updateBatch20IssueEvents[batchNumber]
        const updatedIssueEvents = await batchUpdateOutlookEvent(
          client,
          issueEventBatch,
          projectCategories
        )

        loggerInfo({ updatedIssueEvents })

      }

      await Issue.bulkWrite(issueEventsUpdateBulkOps)
      await OutlookSync.updateOne(
        { _id: outlookSyncId },
        {
          $addToSet: { recentlyCreatedIssueEventsOutlookIds: { $each: createdOutlookIds } }
        }
      );
    }
  }


  loggerInfo({
    duplicateIssueEventOutlookIdsInOutlookToDelete
  })
  // for (const outlookId of duplicateIssueEventOutlookIdsInOutlookToDelete) {
  //   await deleteOutlookEvent(client, outlookId)
  // }
  await deleteOutlookEvents20PerBatch(client, duplicateIssueEventOutlookIdsInOutlookToDelete)
}

// ------------------------------------
// ------- FIRST CALENDAR SYNC --------
// ------------------------------------
const firstCalendarSync = async (_, { projectId, outlookSyncId }, { models }) => {
  const startTime = Date.now()
  try {
    loggerInfo('--------------- first Calendar Sync -----------------------')
    // update outlooksync status and timestamp
    await models.OutlookSync.updateOne({ _id: outlookSyncId }, {
      status: OutlookSyncStatusTypes.SYNCING,
      syncStartAt: new Date()
    })
    // find project
    const projectFound = await models.Project.findById(projectId)
    const { accessToken, refreshToken, calendarId } = projectFound && projectFound.outlook || {}
    // define variables
    const client = await getClientWithUpdateToken({ accessToken, refreshToken, models, projectId })
    const timeZone = projectFound && projectFound.timeZone
    const outlookCalendarId = calendarId
    const projectPrefixes = [...(projectFound && projectFound.prefixes) || []]
      .sort((a, b) => (a.position - b.position))
    const prefixesFieldIds = projectPrefixes.filter(p => p.fieldId).map(p => mongoose.Types.ObjectId(p.fieldId))

    const projectCategories = await getProjectCategories({ projectId })

    const aggregateOpsPrefixTitle = getAggregateOpsEventPrefixTitle({ prefixesFieldIds, projectPrefixes })

    const projectCustomFieldsFound = await models.CustomField.find({
      projectId,
      type: { $in: ['checkbox', 'date'] },
    });

    // get date customfields
    const dateCustomFieldsFound = projectCustomFieldsFound.filter(f => f.type === 'date')
    const dateCustomFieldsIds = await dateCustomFieldsFound.map(cf => mongoose.Types.ObjectId(cf._id))

    const hiddenDateCustomFieldsFound = dateCustomFieldsFound.filter(f => f.hideFromCalendar)
    const hiddenDateCustomFieldsIds = hiddenDateCustomFieldsFound.map(cf => mongoose.Types.ObjectId(cf._id))

    // get checkbox customfields
    const checkboxCustomFieldsFound = projectCustomFieldsFound.filter(f => f.type === 'checkbox')
    const checkboxCustomFieldsIds = checkboxCustomFieldsFound.map(f => f._id)

    loggerInfo({
      checkboxCustomFieldsIds,
      projectCustomFieldsFound
    })

    const aggregateOpsEventDuration = getAggregateOpsEventDuration({
      projectCheckBoxFieldsIds: checkboxCustomFieldsIds,
      projectDateCustomFields: dateCustomFieldsFound
    })

    const outlookSyncFound = await models.OutlookSync.findById(
      outlookSyncId,
      {
        events: 1,
        seriesMasterEvents: 1,
        newDeltaLink: 1,
        initStartAt: 1,
        initStartAt: 1,
      }
    )
    const outlookEventsResult = await (outlookSyncFound.events || [])
    const outlookSeriesMasterEvents = await outlookSyncFound.seriesMasterEvents

    const matchingEventsOutlookIds = []

    const addToMatchingEventsOutlookIds = (e) => matchingEventsOutlookIds.push(e)
    // ----- CREATE events in   -----
    await createEventsInOutlook({
      client,
      projectId,
      timeZone,
      projectCategories,
      outlookCalendarId,
      outlookSyncId,
      outlookEventsResult,
      addToMatchingEventsOutlookIds
    })

    loggerInfo({ matchingEventsOutlookIds })

    // ------ CREATE issue events in  -----
    await createIssueEvents({
      aggregateOpsPrefixTitle,
      aggregateOpsEventDuration,
      dateCustomFieldsIds,
      projectId,
      timeZone,
      client,
      outlookCalendarId,
      outlookSyncId,
      projectCategories,
      customFields: dateCustomFieldsFound,
      outlookEventsResult,
      addToMatchingEventsOutlookIds,
      hiddenDateCustomFieldsIds
    })

    // --------------------------------------------
    // ----- CREATE EVENTS IN (DB) FROM OUTLOOK ----- 
    // --------------------------------------------
    // const outlookSyncFound = await models.OutlookSync.findById(outlookSyncId)
    // const outlookEventsResult = await outlookSyncFound.events
    // const outlookSeriesMasterEvents = await outlookSyncFound.seriesMasterEvents

    loggerInfo('>>> creating events from outlook to db...')

    const startDateTime = CalendarSyncRange.getStart()
    const endDateTime =  CalendarSyncRange.getEnd()
    // const startDateTime = moment().subtract(1, 'year').startOf('year').toDate();
    // const endDateTime = moment().add(2, 'year').endOf('year').toDate();

    const exceptionEventsFound = await Event.find({
      projectId,
      outlookId: null,
      type: OutlookEventTypes.EXCEPTION,
      deletedAt: null,
      $or: [
        { archived: false },
        { archived: null },
      ],
      $or: [
        {
          $and: [
            { start: { $gte: startDateTime } },
            { start: { $lte: endDateTime } },
          ],
        },
        {
          $and: [
            { end: { $gte: startDateTime } },
            { end: { $lte: endDateTime } },
          ],
        },
        {
          $and: [
            { start: { $lte: startDateTime } },
            { end: { $gte: endDateTime } },
          ],
        },
      ]
    })

    const seriesMasterEventsFound = await Event.find({
      projectId,
      outlookId: { $ne: null },
      type: OutlookEventTypes.SERIES_MASTER,
      deletedAt: null,
      $or: [
        { archived: false },
        { archived: null },
      ],
    })

    loggerInfo({ seriesMasterEventsFound })

    const outlookEventsToSave = [];
    const duplicates = [];
    const exceptionEventsUpdateBulkOps = []
    const matchedExceptionEventIds = []

    for (const event of outlookEventsResult) {
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
                start: event.start + 'Z',
                end: event.end + 'Z',

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

            const exceptionMasterEvent = event.outlookId && seriesMasterEventsFound.find(me => me.outlookId === event.seriesMasterId)

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
              matchingEvent
            })
            if (matchingEvent) {
              exceptionEventsUpdateBulkOps.push({
                updateOne: {
                  filter: { _id: mongoose.Types.ObjectId(matchingEvent.id) },
                  update: {
                    outlookId: event.outlookId,
                    categoryId: event.categoryId,
                    updatedAt: new Date()
                  }
                }
              })
              matchedExceptionEventIds.push(matchingEvent.id)
            } else {
              eventToSave = {
                title: event.title || ' ',
                start: event.start + 'Z',
                end: event.end + 'Z',
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
            eventToSave = {
              title: event.title || ' ',
              start: event.start + 'Z',
              end: event.end + 'Z',
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

          if (eventToSave !== null) outlookEventsToSave.push(eventToSave)
        }
      }
    }

    loggerInfo({ duplicatesLength: duplicates.length, matchedExceptionEventIds })
    // -----------------------------------
    // --- create outlook events to (DB) ---
    await models.Event.insertMany(outlookEventsToSave)
    await models.Event.bulkWrite(exceptionEventsUpdateBulkOps)

    await saveOutlookIdsOfOccurrenceEvents({
      projectId,
      models,
      outlookSyncId,
      accessToken,
      refreshToken,
      client,
      timeZone,
      projectCategories,
      matchedExceptionEventIds
    })


    // update outlooksync to finish sync
    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        started: false,
        finished: true,
        status: OutlookSyncStatusTypes.SUCCESS,
        syncEndAt: new Date(),
        failedAt: null,
        isFirstSync: false,
        newDeltaLink: null,
        deltaLink: outlookSyncFound.newDeltaLink,
        ...outlookSyncFound.initStartAt && { lastSyncInitStartAt: new Date(outlookSyncFound.initStartAt) }
      }
    )

    loggerInfo('time', (Date.now() - startTime) / 1000 + ' seconds')

    return outlookSyncId

  } catch (e) {
    loggerError('ERROR: firstSyncCalendar, ', { e })
    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        started: false,
        finished: true,
        status: OutlookSyncStatusTypes.FAILED_FIRST_SYNCING,
        failedAt: new Date(),
      }
    )
    return e
  }
};

module.exports = {
  firstCalendarSync,
}
