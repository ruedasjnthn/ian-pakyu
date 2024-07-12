const { loggerError, loggerInfo } = require("../../../../config/logger")
const { OutlookCalendarSyncStatus } = require("../../../../constants/outlook-calendar")

const updateOutlookSyncStatus = async (_, { }, { models }) => {
  try {
    const steps = [
      // step 1
      {
        from: OutlookCalendarSyncStatus.DONE_TO_INITIALIZE,
        to: OutlookCalendarSyncStatus.READY_TO_SYNC_DELETED_EVENTS
      },
      // step 2
      {
        from: OutlookCalendarSyncStatus.DONE_TO_SYNC_DELETED_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_SYNC_OUTLOOK_EVENTS
      },
      // step 3
      {
        from: OutlookCalendarSyncStatus.DONE_TO_SYNC_OUTLOOK_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_SYNC_UPDATED_EVENTS
      },
      // step 4
      {
        from: OutlookCalendarSyncStatus.DONE_TO_SYNC_UPDATED_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_SYNC_UPDATED_ISSUE_EVENTS
      },
      // step 5
      {
        from: OutlookCalendarSyncStatus.DONE_TO_SYNC_UPDATED_ISSUE_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_DELETE_OUTLOOK_EVENTS
      },
      // step 6
      {
        from: OutlookCalendarSyncStatus.DONE_TO_DELETE_OUTLOOK_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_DELETE_OUTLOOK_ISSUE_EVENTS
      },
      // step 7
      {
        from: OutlookCalendarSyncStatus.DONE_TO_DELETE_OUTLOOK_ISSUE_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_DELETE_EVENTS
      },
      // step 8
      {
        from: OutlookCalendarSyncStatus.DONE_TO_DELETE_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_DELETE_HIDDEN_ISSUE_EVENTS
      },
      // step 9
      {
        from: OutlookCalendarSyncStatus.DONE_TO_DELETE_HIDDEN_ISSUE_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_SYNC_NEW_EVENTS
      },
      // step 10
      {
        from: OutlookCalendarSyncStatus.DONE_TO_SYNC_NEW_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_SYNC_NEW_ISSUE_EVENTS
      },
      // step 11
      {
        from: OutlookCalendarSyncStatus.DONE_TO_SYNC_NEW_ISSUE_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_SYNC_UPDATED_SERIES_EVENTS
      },
      // step 12
      {
        from: OutlookCalendarSyncStatus.DONE_TO_SYNC_UPDATED_SERIES_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_FETCH_NEW_OUTLOOK_SERIES_EVENTS
      },
      // step 13
      {
        from: OutlookCalendarSyncStatus.DONE_TO_FETCH_NEW_OUTLOOK_SERIES_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS
      },
      // step 14
      {
        from: OutlookCalendarSyncStatus.DONE_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_SYNC_EVENT_CATEGORIES
      },
      // step 15
      {
        from: OutlookCalendarSyncStatus.DONE_TO_SYNC_EVENT_CATEGORIES,
        to: OutlookCalendarSyncStatus.READY_TO_FINISH_SYNC_UPDATE
      },
    ]

    const outlookSyncUpdateOps = steps.map(step => ({
      updateMany: {
        filter: { status: step.from, isFirstSync: false },
        update: { status: step.to, updatedAt: new Date(), },
      },
    }))


    loggerInfo('updateOutlookSyncStatus', { outlookSyncUpdateOps })

    await models.OutlookSync.bulkWrite(outlookSyncUpdateOps)

    return true

  } catch (error) {
    loggerError('updateOutlookSyncStatus', { errorMsg: error.message, error })
    return error
  }
}

module.exports = {
  updateOutlookSyncStatus
}