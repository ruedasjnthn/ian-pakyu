const { loggerError, loggerInfo } = require("../../../../config/logger")
const { OutlookCalendarSyncStatus } = require("../../../../constants/outlook-calendar")
const { updateOutlookSyncStatusHelper } = require("../../../../helper/OutlookSyncHelper")

const finishOutlookUpdateSync = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.FINISHING_SYNC_UPDATE
    })

    const outlookSyncFound = await models.OutlookSync.findById(
      outlookSyncId,
      'newDeltaLink initStartAt'
    )

    loggerInfo('finishOutlookUpdateSync', { outlookSyncFound })


    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        started: false,
        finished: true,
        status: OutlookCalendarSyncStatus.SUCCESS,
        syncEndAt: new Date(),
        failedAt: null,
        newDeltaLink: null,
        // deltaLink: outlookSyncFound.newDeltaLink,
        ...outlookSyncFound.newDeltaLink && { deltaLink: outlookSyncFound.newDeltaLink },
        ...!!outlookSyncFound.initStartAt && {
          lastSyncInitStartAt: new Date(outlookSyncFound.initStartAt)
        }
      }
    )

    return outlookSyncId

  } catch (err) {
    loggerError('finishOutlookUpdateSync ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_FINISH_SYNC_UPDATE,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err
  }
}


module.exports = {
  finishOutlookUpdateSync
}