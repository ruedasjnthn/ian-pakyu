const { deleteOutlookEvents20PerBatch, createOutlookEventsPerBatch, updateOutlookEvent } = require('../../../../helper/OutlookEventHelper');
const mongoose = require('mongoose');
const { OutlookEventTypes, CalendarSyncRange } = require('../../../../constants/outlook');
const { getAggregateOpsEventPrefixTitle, formatIssueEventToOutlook, getAggregateOpsEventDuration, } = require('../../../../helper/EventHelper');
const moment = require("moment");
const momentTz = require("moment-timezone");
const { isEventOutOfRange } = require('../../../../helper/SyncHelper');
const { allDayDateFormat, dateFormat, dateComparingFormat } = require('../../../../constants/calendar');
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, getOutlookSyncVars, getProjectCustomFields } = require('../../../../helper/OutlookSyncHelper');
const { OutlookCalendarSyncStatus, CalendarSyncLimit } = require('../../../../constants/outlook-calendar');
const { isSameId } = require('../../../../helper/StringHelper');
const { getProjectCategories } = require('../../../../helper/CategoryHelper');

const maxLimit = CalendarSyncLimit.UPDATE_ISSUE_EVENT_LIMIT
// limit of issue to process
const getLimit = (customFieldsLength) => customFieldsLength > 0
  ? Math.ceil(maxLimit / customFieldsLength)
  : maxLimit

const getHasMoreIssueEvents = async ({ models, issueEventsFilter, limit }) => {
  const issueEventsCount = await models.Issue.aggregate([
    { $match: issueEventsFilter },
    { $count: 'totalCount' }
  ])

  const totalCount = issueEventsCount && issueEventsCount[0]
    ? issueEventsCount[0].totalCount
    : 0

  const hasMore = totalCount > limit

  return hasMore
}


// sync issues 
const syncIssueEvents = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.SYNCING_ISSUE_EVENTS
    })

    const {
      client,
      outlookCalendarId,
      prefixesFieldIds,
      timeZone,
      projectPrefixes
    } = await getOutlookSyncVars({
      models,
      projectId,
    })

    const {
      checkboxCustomFieldsIds,
      dateCustomFieldsFound,
      shownDateCustomFieldIds
    } = await getProjectCustomFields({ models, projectId })

    const outlookSyncFound = await models.OutlookSync.findById(
      outlookSyncId,
      'events syncedIssueEventsIds'
    )
    const outlookEventsResult = await (outlookSyncFound.events || [])
    const issueEventsIdsAlreadySynced = await (outlookSyncFound.syncedIssueEventsIds || [])

    const aggregateOpsPrefixTitle = getAggregateOpsEventPrefixTitle({ prefixesFieldIds, projectPrefixes })

    const aggregateOpsEventDuration = getAggregateOpsEventDuration({
      projectCheckBoxFieldsIds: checkboxCustomFieldsIds,
      projectDateCustomFields: dateCustomFieldsFound
    })

    const projectCategories = await getProjectCategories({ projectId })

    const customFields = dateCustomFieldsFound

    const limit = getLimit(customFields.length)

    const issueEventsFilter = {
      projectId: mongoose.Types.ObjectId(projectId),
      archived: { $not: { $eq: true } },
      deletedAt: null,
      _id: { $nin: issueEventsIdsAlreadySynced },
      // 'issueCustomFields.fieldId': { $in: shownDateCustomFieldIds },
      issueCustomFields: {
        $elemMatch: {
          fieldId: { $in: shownDateCustomFieldIds, },
          outlookId: { $in: [null, undefined] },
          $and: [
            { value: { $gte: CalendarSyncRange.getStart() } },
            { value: { $lte: CalendarSyncRange.getEnd() } }
          ]
        }
      }
    }

    const issuesWithEventsFound = await models.Issue.find(issueEventsFilter, 'id').limit(limit)
    const issuesWithEventsIds = issuesWithEventsFound.map(i => mongoose.Types.ObjectId(i._id))

    const hasMoreIssueEvents = await getHasMoreIssueEvents({ models, issueEventsFilter, limit })
    loggerInfo('syncIssueEvents', { hasMoreIssueEvents, limit, issuesWithEventsIds })

    const duplicateIssueEventOutlookIdsInOutlookToDelete = []
    const issueEventsUpdateBulkOps = []
    const issueEventsToCreateInOutlook = []
    const issueEventsToUpdateInOutlook = []
    const issueEventsResIdIssueFieldId = []
    const createdOutlookIds = []
    const matchingEventsOutlookIds = new Set()

    if (issuesWithEventsIds.length > 0) {
      // find issue events to create in outlook
      const issueEventsFound = await models.Issue.aggregate([
        {
          $match: { _id: { $in: issuesWithEventsIds } },
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
                    // { $in: ["$$issueCustomField.outlookId", [null, undefined]], },
                    { $not: { $in: ["$$issueCustomField.value", [null, undefined]], }, },
                    { $gte: ["$$issueCustomField.value", CalendarSyncRange.getStart()] },
                    { $lte: ["$$issueCustomField.value", CalendarSyncRange.getEnd(),], },
                  ]
                }
              },
            },
          },
        },
        { $unwind: '$issueCustomFields' },
        { $match: { "issueCustomFields.outlookId": { $in: [null, undefined] } } }
        // { $match: { "issueCustomFields.outlookId": null, "issueCustomFields.value": { $not: { $eq: null } } }, },
      ]);




      // loggerInfo({ issueEventsFound })

      for (const issueEvent of issueEventsFound) {
        const formattedEvent = formatIssueEventToOutlook(
          issueEvent,
          timeZone,
          { customFields, projectCategories }
        );

        loggerInfo('issueEvents formattedEvent', formattedEvent)

        if (formattedEvent) {

          const isOutsideRange = isEventOutOfRange({
            eventStartDate: formattedEvent.start.dateTime,
            eventEndDate: formattedEvent.end.dateTime,
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
                matchingEventsOutlookIds.add(matchingEventItem.outlookId)
              }
            }

            loggerInfo({
              matchingEvent,
            })

            if (matchingEvent) {
              matchingEventsOutlookIds.add(matchingEvent.outlookId)

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

            }

          }
        }
      }

      const createdEvents = await createOutlookEventsPerBatch(
        client,
        issueEventsToCreateInOutlook,
        outlookCalendarId,
        projectCategories
      )


      for (const createdEvent of createdEvents) {
        const issueEventResIdIssueFieldId = issueEventsResIdIssueFieldId.find(e => isSameId(e.reqId, createdEvent.resId))

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

      for (const issueEvent of issueEventsToUpdateInOutlook) {
        const eventOutlookId = issueEvent.outlookId
        const updatedEvent = await updateOutlookEvent(
          client,
          eventOutlookId,
          issueEvent,
          projectCategories
        )
        loggerInfo({ eventOutlookId, updatedEvent })
      }
      // await updateOutlookEventsPerBatch(client, issueEventsToUpdateInOutlook)
      loggerInfo({ createdOutlookIds, })

      await models.Issue.bulkWrite(issueEventsUpdateBulkOps)

      loggerInfo({ duplicateIssueEventOutlookIdsInOutlookToDelete })
      await deleteOutlookEvents20PerBatch(client, duplicateIssueEventOutlookIdsInOutlookToDelete)
    }

    loggerInfo({ issuesWithEventsIds, })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: hasMoreIssueEvents
          ? OutlookCalendarSyncStatus.READY_TO_SYNC_ISSUE_EVENTS
          : OutlookCalendarSyncStatus.DONE_TO_SYNC_ISSUE_EVENTS,
        updatedAt: new Date(),
        $addToSet: {
          recentlyCreatedIssueEventsOutlookIds: { $each: createdOutlookIds },
          syncedIssueEventsIds: { $each: issuesWithEventsIds },
          matchingEventsOutlookIds: { $each: [...matchingEventsOutlookIds] }
        }
      }
    );

    return outlookSyncId

  } catch (err) {
    loggerError('syncIssueEvents ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_SYNC_ISSUE_EVENTS,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err
  }
}

module.exports = {
  syncIssueEvents,
}
