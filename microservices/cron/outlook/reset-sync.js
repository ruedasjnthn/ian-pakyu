
const { OutlookSync } = require('../Helper/OutlookSyncHelper')
const { OutlookSyncStatusTypes } = require('../constants/outlook')
const { loggerInfo, loggerError } = require('../config/logger')


async function resetAllSyncs() {
  try {
    loggerInfo(' ----------- Reset All Syncs --------')
    const failedInitSyncsFound = await OutlookSync.find(
      { status: OutlookSyncStatusTypes.INITIALIZING, },
      'status'
    )
    const failedInitSyncsIds = failedInitSyncsFound.map(s => s._id)

    await OutlookSync.updateMany(
      { _id: { $in: failedInitSyncsIds } },
      {
        status: OutlookSyncStatusTypes.FAILED_INITIALIZING,
        failedAt: new Date()
      },
    )

    const failedSyncsFound = await OutlookSync.find(
      { status: OutlookSyncStatusTypes.SYNCING, },
      'status'
    )
    const failedSyncsIds = failedSyncsFound.map(s => s._id)
    await OutlookSync.updateMany(
      { _id: { $in: failedSyncsIds } },
      {
        status: OutlookSyncStatusTypes.FAILED_SYNCING,
        failedAt: new Date()
      },
    )
    loggerInfo({ failedInitSyncsIds, failedSyncsIds })
    loggerInfo(' ----------- Done Reset Sync --------')

  } catch (e) {
    loggerError('ERROR: resetAllSyncs,', { e })
    // return e
  }
}

module.exports = {
  resetAllSyncs
}
