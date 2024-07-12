const { deleteOutlookEvents20PerBatch, } = require('../../../../helper/OutlookEventHelper');
const mongoose = require('mongoose');
const { CalendarLogActionTypes } = require('../../../../constants/calendar');
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, getOutlookSyncVars } = require('../../../../helper/OutlookSyncHelper');
const { OutlookCalendarSyncStatus, CalendarSyncLimit } = require('../../../../constants/outlook-calendar');
const { syncEventsInCalUpdLogs } = require('../../calendarUpdateLogs');
const { CalendarSyncRange } = require('../../../../constants/outlook');

// limit of issue to process
const maxLimit = CalendarSyncLimit.ISSUE_EVENT_LIMIT

const getHasMoreDeletedEventLogs = async ({ models, logsFilter }) => {
  const deletedEventLogsCount = await models.CalendarUpdateLog.count(logsFilter)

  const totalCount = deletedEventLogsCount
    ? deletedEventLogsCount
    : 0

  const hasMore = totalCount > maxLimit

  return hasMore
}

// sync outlook event 
const deleteSyncedOutlookIssueEvents = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.DELETING_OUTLOOK_ISSUE_EVENTS
    })

    // get deleted events based on calendarUpdateLogs
    const logsFilter = {
      projectId,
      action: CalendarLogActionTypes.DELETE,
      synced: false,
      issueEvent: { $ne: null }
    }

    // get deleted events based on calendarUpdateLogs
    const deletedIssueEventLogs = await models.CalendarUpdateLog
      .find(logsFilter)
      .limit(maxLimit)

    loggerInfo({ deletedIssueEventLogs })

    const hasMoreDeletedEventLogs = await getHasMoreDeletedEventLogs({ models, logsFilter })

    const updateLogIds = []
    const outlookIdsToDelete = []
    const issueEventsToDeleteBulkOps = []

    if (deletedIssueEventLogs.length > 0) {

      for (const issueEventLog of deletedIssueEventLogs) {
        // updateLogIds.push(issueEventLog._id)
        outlookIdsToDelete.push(issueEventLog.outlookId)
      }

      const { client } = await getOutlookSyncVars({ models, projectId, })
      const deletedInOutlookEventsOutlookIds = await deleteOutlookEvents20PerBatch(client, outlookIdsToDelete)
   
      const deletedOutlookIds = new Set(deletedInOutlookEventsOutlookIds)

      for (const issueEventLog of deletedIssueEventLogs) {

        const outlookId = issueEventLog.outlookId

        if (deletedOutlookIds.has(outlookId)) {
          // delete issue event in outlook
          updateLogIds.push(issueEventLog._id)
          issueEventsToDeleteBulkOps.push({
            updateOne: {
              filter: {
                _id: mongoose.Types.ObjectId(issueEventLog.issueEvent.issueId),
                'issueCustomFields.fieldId': mongoose.Types.ObjectId(issueEventLog.issueEvent.customFieldId)
              },
              update: { 'issueCustomFields.$.outlookId': null }
            }
          })
        }
      }
    }

    loggerInfo({ updateLogIds, outlookIdsToDelete })

    if (issueEventsToDeleteBulkOps.length > 0)
      await models.Issue.bulkWrite(issueEventsToDeleteBulkOps)

    if (updateLogIds.length > 0)
      await syncEventsInCalUpdLogs({
        _projectId: projectId,
        _action: CalendarLogActionTypes.DELETE,
        _ids: updateLogIds
      })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: hasMoreDeletedEventLogs
          ? OutlookCalendarSyncStatus.READY_TO_DELETE_OUTLOOK_ISSUE_EVENTS
          : OutlookCalendarSyncStatus.DONE_TO_DELETE_OUTLOOK_ISSUE_EVENTS,

        updatedAt: new Date(),
      }
    );

    return outlookSyncId

  } catch (err) {
    loggerError('deleteSyncedOutlookIssueEvents ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_DELETE_OUTLOOK_ISSUE_EVENTS,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err

  }
}

module.exports = {
  deleteSyncedOutlookIssueEvents,
}
