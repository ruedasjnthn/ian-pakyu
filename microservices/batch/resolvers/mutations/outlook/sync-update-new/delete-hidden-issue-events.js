const { deleteOutlookEvents20PerBatch, } = require('../../../../helper/OutlookEventHelper');
const mongoose = require('mongoose');
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, getOutlookSyncVars, getProjectCustomFields } = require('../../../../helper/OutlookSyncHelper');
const { OutlookCalendarSyncStatus, CalendarSyncLimit } = require('../../../../constants/outlook-calendar');
const { ApolloError } = require('apollo-server-express');
const { CalendarSyncRange } = require('../../../../constants/outlook');

// limit of issue to process
const maxLimit = CalendarSyncLimit.ISSUE_EVENT_LIMIT

const getLimit = (customFieldsLength) => customFieldsLength > 0
  ? Math.ceil(maxLimit / customFieldsLength)
  : maxLimit


const getHasMoreIssues = async ({ models, issueFilter, limit }) => {
  const issueCount = await models.Issue.count(issueFilter)

  const totalCount = issueCount
    ? issueCount
    : 0

  const hasMore = totalCount > limit

  return hasMore
}


// delete Outlook Events with custom fields that were hidden from the calendar
const deleteSyncedHiddenOutlookEvents = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.DELETING_HIDDEN_ISSUE_EVENTS
    })

    const outlookSyncFound = await models.OutlookSync.findById(
      outlookSyncId,
      'hiddenCustomFieldsSyncedIssuesIds lastSyncInitStartAt'
    )
    if (!outlookSyncFound) throw new ApolloError('outlook_sync_not_found')

    const hiddenCustomFieldsSyncedIssuesIds = outlookSyncFound.hiddenCustomFieldsSyncedIssuesIds || []
    const lastSyncInitStartAt = outlookSyncFound.lastSyncInitStartAt

    const hiddenDateCustomFieldsFound = await models.CustomField.find(
      {
        projectId,
        type: 'date',
        updatedAt: { $gte: lastSyncInitStartAt },
        hideFromCalendar: true
      },
      'id'
    );

    const hiddenDateCustomFieldsIds = hiddenDateCustomFieldsFound.map(cf => mongoose.Types.ObjectId(cf._id))

    loggerInfo({ hiddenDateCustomFieldsFound, hiddenDateCustomFieldsIds })

    const issueFilter = {
      projectId: mongoose.Types.ObjectId(projectId),
      _id: { $nin: hiddenCustomFieldsSyncedIssuesIds },
      // 'issueCustomFields.fieldId': { $in: hiddenDateCustomFieldsIds },
      issueCustomFields: {
        $elemMatch: {
          fieldId: { $in: hiddenDateCustomFieldsIds, },
          outlookId: { $nin: [null, undefined] },
          $and: [
            { value: { $gte: CalendarSyncRange.getStart() } },
            { value: { $lte: CalendarSyncRange.getEnd() } }
          ]
        }
      }
    }

    const limit = getLimit(hiddenDateCustomFieldsFound.length)

    const issuesWithHiddenFieldsFound = await models.Issue.find(issueFilter, 'id').limit(limit)
    const issuesWithHiddenFieldsIds = issuesWithHiddenFieldsFound.map(i => mongoose.Types.ObjectId(i._id))

    const hasMoreIssues = await getHasMoreIssues({ models, issueFilter, limit })

    loggerInfo('deleteSyncedHiddenOutlookEvents', {
      limit,
      hasMoreIssues,
      issuesWithHiddenFieldsIdsL: issuesWithHiddenFieldsIds.length,
      issuesWithHiddenFieldsIds,
      issuesWithHiddenFieldsFound
    })

    if (issuesWithHiddenFieldsIds.length > 0) {
      const issuesToDelete = await models.Issue.aggregate([
        {
          $match: {
            _id: { $in: issuesWithHiddenFieldsIds }
          }
        },
        {
          $set: {
            issueCustomFields: {
              $filter: {
                input: "$issueCustomFields",
                as: "issueCustomField",
                cond: {
                  $and: [
                    { $in: ["$$issueCustomField.fieldId", hiddenDateCustomFieldsIds], },
                    // { $not: { $in: ["$$issueCustomField.outlookId", [null, undefined]], } },
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
        // {
        //   $match: {
        //     "issueCustomFields.outlookId": { $not: { $eq: null } },
        //   }
        // },
      ]);

      const issueEventsUpdateBulkOps = []
      const issueEventsOutlookIdsToDelete = new Set()

      for (const issue of issuesToDelete) {
        const issueCustomField = issue.issueCustomFields
        const eventOutlookId = issueCustomField && issueCustomField.outlookId

        if (eventOutlookId) issueEventsOutlookIdsToDelete.add(eventOutlookId)
      }

      loggerInfo({
        issuesToDelete: issuesToDelete.map(i => i._id),
        issueEventsOutlookIdsToDelete
      })

      if (issueEventsOutlookIdsToDelete.size > 0) {
        const { client } = await getOutlookSyncVars({ models, projectId, })
        const deletedOutlookIds = await deleteOutlookEvents20PerBatch(client, [...issueEventsOutlookIdsToDelete])

        for (const issue of issuesToDelete) {
          const issueId = issue._id
          const issueCustomField = issue.issueCustomFields
          const eventOutlookId = issueCustomField && issueCustomField.outlookId
          const isEventDeleted = deletedOutlookIds.includes(eventOutlookId)
          loggerInfo({ issueCustomField, eventOutlookId, isEventDeleted })

          if (isEventDeleted)
            issueEventsUpdateBulkOps.push({
              updateOne: {
                filter: {
                  _id: mongoose.Types.ObjectId(issue._id),
                  'issueCustomFields.fieldId': mongoose.Types.ObjectId(issueCustomField.fieldId)
                },
                update: {
                  '$unset': {
                    'issueCustomFields.$.outlookId': "",
                  },
                }
              }
            })
        }
      }

      if (issueEventsUpdateBulkOps.length > 0)
        await models.Issue.bulkWrite(issueEventsUpdateBulkOps)
    }
    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {

        status: hasMoreIssues
          ? OutlookCalendarSyncStatus.READY_TO_DELETE_HIDDEN_ISSUE_EVENTS
          : OutlookCalendarSyncStatus.DONE_TO_DELETE_HIDDEN_ISSUE_EVENTS,

        updatedAt: new Date(),

        $addToSet: {
          hiddenCustomFieldsSyncedIssuesIds: { $each: issuesWithHiddenFieldsIds },
        }
      }
    );

    return outlookSyncId

  } catch (err) {
    loggerError('deleteSyncedHiddenOutlookEvents ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_DELETE_HIDDEN_ISSUE_EVENTS,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err

  }
}

module.exports = {
  deleteSyncedHiddenOutlookEvents,
}
