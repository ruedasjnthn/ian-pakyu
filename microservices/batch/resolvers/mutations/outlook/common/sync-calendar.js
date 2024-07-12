const { ApolloError } = require("apollo-server-express");
const { loggerError, loggerInfo } = require("../../../../config/logger");
const { OutlookCalendarSyncStatus, FailedOutlookCalendarSyncStatus, SyncingOutlookCalendarSyncStatus, OutlookCalendarSyncStatusArray, } = require("../../../../constants/outlook-calendar");
const { updateOutlookSyncStatusHelper } = require("../../../../helper/OutlookSyncHelper");
const mongoose = require('mongoose');

const syncCalendar = async (_, { projectId }, { models, user }) => {
  try {

    // check if there is another project  with the same calendar sync
    const projectFound = await models.Project.findById(projectId, 'outlook')
    if (!projectFound) throw new ApolloError('project_not_found')

    const calendarId = projectFound.outlook && projectFound.outlook.calendarId
    if (!calendarId) throw new ApolloError('no_calendar_selected')

    const exisitingCalendarSync = await models.OutlookSync.findOne(
      { projectId: { $not: { $eq: projectId } }, calendarId },
      'status'
    )

    loggerInfo({ exisitingCalendarSync })
    if (exisitingCalendarSync) throw new ApolloError('calendar_already_synced_in_another_project')

    const outlookSyncCount = await models.OutlookSync.count({ projectId })
    if (outlookSyncCount > 1) throw new ApolloError('there_are_more_than_two_outlook_sync')

    const outlookSyncFound = await models.OutlookSync.findOne({ projectId }, 'status isFirstSync')
    // if (!outlookSyncFound) throw new ApolloError('outlook_sync_not_found')

    let outlookSyncId;

    if (outlookSyncFound) {
      // if outlookSync already exist

      outlookSyncId = outlookSyncFound._id
      const outlookSyncStatus = outlookSyncFound.status
      const isFirstSync = outlookSyncFound.isFirstSync

      // const isInitializing = InitializingOutlookCalendarSyncStatus.includes(outlookSyncStatus)
      // const isPending = PendingOutlookCalendarSyncStatus.includes(outlookSyncStatus)
      // const isBusy = BusyOutlookCalendarSyncStatus.includes(outlookSyncStatus)
      const isSyncing = SyncingOutlookCalendarSyncStatus.includes(outlookSyncStatus)
      const isFailed = FailedOutlookCalendarSyncStatus.includes(outlookSyncStatus)
      const isSuccess = outlookSyncStatus === OutlookCalendarSyncStatus.SUCCESS
      const isNotInStatusArray = !OutlookCalendarSyncStatusArray.includes(outlookSyncStatus)

      const canSync = isSuccess || isFailed || isNotInStatusArray
      if (!canSync) throw new ApolloError('outlook_sync_is_still_processing')

      // if (isOutlookSyncProcessing) throw new ApolloError('outlook_sync_is_still_processing')
      let newStatus = isSyncing
        ? OutlookCalendarSyncStatus.DONE_TO_INITIALIZE
        : OutlookCalendarSyncStatus.READY_TO_PREP_INIT;

      if (isFailed) newStatus = OutlookCalendarSyncStatus.READY_TO_PREP_INIT

      await updateOutlookSyncStatusHelper({
        models,
        outlookSyncId,
        status: newStatus,
      })

    } else {
      // if outlookSync doesnt exist create one

      outlookSyncId = mongoose.Types.ObjectId()
      await models.OutlookSync.create({
        _id: outlookSyncId,
        projectId,
        status: OutlookCalendarSyncStatus.READY_TO_PREP_INIT,
        createdAt: new Date(),
        userId: user.sub,
        calendarId,
        isFirstSync: true,
      })
    }

    return outlookSyncId
  } catch (err) {
    loggerError('syncCalendar ERROR', { errMessage: err.message, err })
    return err
  }
}

module.exports = {
  syncCalendar
}
