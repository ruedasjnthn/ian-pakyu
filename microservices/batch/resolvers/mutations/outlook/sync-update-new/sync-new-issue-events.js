const { createOutlookEventsPerBatch } = require('../../../../helper/OutlookEventHelper');
const mongoose = require('mongoose');
const { getAggregateOpsEventPrefixTitle, formatIssueEventToOutlook, getAggregateOpsEventDuration, } = require('../../../../helper/EventHelper');
const { isEventOutOfRange } = require('../../../../helper/SyncHelper');
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, getProjectCustomFields, getOutlookSyncVarsNoClient, getClientForCalendarSync } = require('../../../../helper/OutlookSyncHelper');
const { OutlookCalendarSyncStatus, CalendarSyncLimit } = require('../../../../constants/outlook-calendar');
const { isSameId } = require('../../../../helper/StringHelper');
const { getProjectCategories } = require('../../../../helper/CategoryHelper');
const { ApolloError } = require('apollo-server-express');
const { CalendarRangeFilter, CalendarSyncRange } = require('../../../../constants/outlook');

const maxLimit = CalendarSyncLimit.ISSUE_EVENT_LIMIT
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
const syncNewIssueEvents = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.SYNCING_NEW_ISSUE_EVENTS
    })

    const {
      tokens,
      outlookCalendarId,
      prefixesFieldIds,
      timeZone,
      projectPrefixes
    } = await getOutlookSyncVarsNoClient({
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
      'syncedIssueEventsIds'
    )
    if (!outlookSyncFound) throw new ApolloError('outlook_sync_not_found')

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

    loggerInfo('syncNewIssueEvents', {
      limit,
      hasMoreIssueEvents,
      issuesWithEventsIds,
      issuesWithEventsIdsL: issuesWithEventsIds.length,
      issuesWithEventsFound
    })

    const createdOutlookIds = new Set()

    if (issuesWithEventsIds.length > 0) {
      // find issue events to create in outlook
      const issueEventsFound = await models.Issue.aggregate([
        {
          $match: {
            _id: { $in: issuesWithEventsIds }
          }
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
                    { $in: ["$$issueCustomField.fieldId", shownDateCustomFieldIds] },
                    // { $in: ["$$issueCustomField.outlookId", [null, undefined]] },
                    { $not: { $in: ["$$issueCustomField.value", [null, undefined]] } },
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
      ]);

      loggerInfo({
        issueEventsFoundL: issueEventsFound.length,
        issueEventsFound: JSON.stringify(issueEventsFound)
      })

      const issueEventsToCreateInOutlook = []
      const issueEventsResIdIssueFieldId = []

      for (const issueEvent of issueEventsFound) {

        const formattedEvent = formatIssueEventToOutlook(
          issueEvent,
          timeZone,
          {
            customFields,
            projectCategories,
          }
        );

        if (formattedEvent) {
          const isOutsideRange = isEventOutOfRange({
            eventStartDate: formattedEvent.start.dateTime,
            timeZone
          });

          if (!isOutsideRange) {

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


      const issueEventsUpdateBulkOps = []

      if (issueEventsToCreateInOutlook.length > 0) {
        const client = await getClientForCalendarSync({ models, projectId, tokens })
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
            createdOutlookIds.add(createdEvent.outlookId)
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

      if (issueEventsUpdateBulkOps.length > 0)
        await models.Issue.bulkWrite(issueEventsUpdateBulkOps)
    }

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: hasMoreIssueEvents
          ? OutlookCalendarSyncStatus.READY_TO_SYNC_NEW_ISSUE_EVENTS
          : OutlookCalendarSyncStatus.DONE_TO_SYNC_NEW_ISSUE_EVENTS,
        updatedAt: new Date(),
        $addToSet: {
          recentlyCreatedIssueEventsOutlookIds: { $each: [...createdOutlookIds] },
          syncedIssueEventsIds: { $each: issuesWithEventsIds },
        }
      }
    );

    return outlookSyncId

  } catch (err) {
    loggerError('syncNewIssueEvents ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_SYNC_NEW_ISSUE_EVENTS,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err
  }
}

module.exports = {
  syncNewIssueEvents,
}
