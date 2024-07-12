
const { OutlookContactSync } = require('../../Helper/OutlookContactSyncHelper')
const { OutlookSyncStatusTypes } = require('../../constants/outlook')
const { loggerInfo, loggerError } = require('../../config/logger')


async function resetAllContactSyncs() {
  try {
    // await OutlookContactSync.updateMany(
    //   { status: OutlookSyncStatusTypes.INITIALIZING, },
    //   {
    //     started: false,
    //     finished: true,
    //     status: OutlookSyncStatusTypes.FAILED_INITIALIZING,
    //     failedAt: new Date()
    //   },
    // )

    // await OutlookContactSync.updateMany(
    //   { status: OutlookSyncStatusTypes.SYNCING, },
    //   {
    //     status: OutlookSyncStatusTypes.FAILED_SYNCING,
    //     started: false,
    //     finished: true,
    //     failedAt: new Date()
    //   },
    // )

  } catch (e) {
    loggerError('resetAllContactSyncs ERROR: ', { e })
  }
}

module.exports = {
  resetAllContactSyncs
}
