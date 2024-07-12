const { loggerError, loggerInfo } = require("../../../../config/logger")
const { OutlookCalendarSyncStatus } = require("../../../../constants/outlook-calendar")

const updateFirstOutlookSyncStatus = async (_, { }, { models }) => {
  try {
    const steps = [
      // step 1
      {
        from: OutlookCalendarSyncStatus.DONE_TO_INITIALIZE,
        to: OutlookCalendarSyncStatus.READY_TO_SYNC_ISSUE_EVENTS
      },
      // step 2
      {
        from: OutlookCalendarSyncStatus.DONE_TO_SYNC_ISSUE_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_SYNC_EVENTS
      },
      // step 3
      {
        from: OutlookCalendarSyncStatus.DONE_TO_SYNC_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_SYNC_SERIES_EVENTS
      },
      // step 4
      {
        from: OutlookCalendarSyncStatus.DONE_TO_SYNC_SERIES_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_FETCH_NEW_OUTLOOK_SERIES_EVENTS
      },
      // step 5
      {
        from: OutlookCalendarSyncStatus.DONE_TO_FETCH_NEW_OUTLOOK_SERIES_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS
      },
      // step 6
      {
        from: OutlookCalendarSyncStatus.DONE_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS,
        to: OutlookCalendarSyncStatus.READY_TO_FINISH_FIRST_SYNC
      },
    ]

    const outlookSyncUpdateOps = steps.map(step => ({
      updateMany: {
        filter: { status: step.from, isFirstSync: true },
        update: { status: step.to, updatedAt: new Date(), },
      },
    }))


    loggerInfo('updateFirstOutlookSyncStatus', { outlookSyncUpdateOps })

    await models.OutlookSync.bulkWrite(outlookSyncUpdateOps)

    return true

  } catch (error) {
    loggerError('updateFirstOutlookSyncStatus', { errorMsg: error.message, error })
    return error
  }
}

module.exports = {
  updateFirstOutlookSyncStatus
}  
