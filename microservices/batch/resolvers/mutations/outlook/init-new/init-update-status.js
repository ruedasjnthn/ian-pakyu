const { loggerError, loggerInfo } = require("../../../../config/logger")
const { OutlookCalendarSyncStatus } = require("../../../../constants/outlook-calendar")
const moment = require('moment')

const updateInitOutlookSyncStatus = async (_, { }, { models }) => {
  try {
    const steps = [
      // step 1
      {
        from: OutlookCalendarSyncStatus.SUCCESS,
        to: OutlookCalendarSyncStatus.READY_TO_PREP_INIT
      },
      // step 2
      {
        from: OutlookCalendarSyncStatus.DONE_TO_PREP_INIT,
        to: OutlookCalendarSyncStatus.READY_TO_INITIALIZE
      },
    ]

    const outlookSyncUpdateOps = steps.map(step => {
      const isFromSuccess = step.from === OutlookCalendarSyncStatus.SUCCESS
      return ({
        updateMany: {
          filter: {
            status: step.from,
            ...isFromSuccess && {
              $or: [
                { syncEndAt: null },
                {
                  syncEndAt: {
                    $lte: moment().subtract(1, 'minutes').toDate()
                  },
                }
              ]
            }
          },
          update: { status: step.to, updatedAt: new Date(), },
        },
      })
    })

    loggerInfo('updateInitOutlookSyncStatus', { outlookSyncUpdateOps })

    await models.OutlookSync.bulkWrite(outlookSyncUpdateOps)

    return true

  } catch (error) {
    loggerError('updateInitOutlookSyncStatus', { errorMsg: error.message, error })
    return error
  }
}

module.exports = {
  updateInitOutlookSyncStatus
}