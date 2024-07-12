const { loggerError } = require("../../../../config/logger")
const { OutlookCalendarSyncStatus, InitializingOutlookCalendarSyncStatus, SyncingOutlookCalendarSyncStatus, FailedOutlookCalendarSyncStatus } = require("../../../../constants/outlook-calendar")

const resetAllOutlookSyncStatus = async (_, { }, { models }) => {
  try {

    const updateOutlookSyncOps = [
      // reset initializing sync from the start
      {
        updateMany: {
          filter: {
            $and: [
              { status: { $nin: FailedOutlookCalendarSyncStatus }, },
              { status: { $in: InitializingOutlookCalendarSyncStatus }, }
            ]
          },
          update: {
            status: OutlookCalendarSyncStatus.READY_TO_PREP_INIT,
            updatedAt: new Date()
          }
        }
      },
      // reset syncing  outlook sync from initializing 
      {
        updateMany: {
          filter: {
            $and: [
              { status: { $nin: FailedOutlookCalendarSyncStatus }, },
              { status: { $in: SyncingOutlookCalendarSyncStatus }, }
            ],
          },
          update: {
            status: OutlookCalendarSyncStatus.DONE_TO_INITIALIZE,
            updatedAt: new Date()
          }
        }
      }
    ]

    // loggerInfo('resetAllOutlookSyncStatus', { updateOutlookSyncOps: JSON.stringify(updateOutlookSyncOps) })

    await models.OutlookSync.bulkWrite(updateOutlookSyncOps)

    return true

  } catch (error) { 
    loggerError('resetAllOutlookSyncStatus', { errorMsg: error.message, error })
    return error
  }
}

module.exports = {
  resetAllOutlookSyncStatus
}