const mongoose = require('mongoose');
const { ApolloError } = require('apollo-server-express');
const { OutlookSyncStatusTypes } = require('../../../constants/outlook');
const { loggerInfo, loggerError } = require('../../../config/logger');
const { OutlookCalendarSyncStatus } = require('../../../constants/outlook-calendar');


const readyToInitializeSync = async (_, { projectId }, { models, user }) => {
  try {

    const ongoingSync = await models.OutlookSync.findOne(
      {
        projectId,
        status: {
          $in: [
            OutlookSyncStatusTypes.READY_TO_INITIALIZE,
            OutlookSyncStatusTypes.READY_TO_SYNC,
            OutlookSyncStatusTypes.PENDING,
            OutlookSyncStatusTypes.INITIALIZING,
            OutlookSyncStatusTypes.SYNCING,
            OutlookSyncStatusTypes.DISABLING,
            OutlookSyncStatusTypes.AUTHORIZING,
            OutlookSyncStatusTypes.FAILED_FIRST_SYNCING,
            OutlookSyncStatusTypes.FAILED_FIRST_INITIALIZING,
          ]
        },
      },
      'status'
    )

    if (ongoingSync) {
      if (
        ongoingSync.status === OutlookSyncStatusTypes.FAILED_FIRST_SYNCING ||
        ongoingSync.status === OutlookSyncStatusTypes.FAILED_FIRST_INITIALIZING
      )
        throw new ApolloError('reenable_sync_in_settings')
      else if (ongoingSync.status === OutlookSyncStatusTypes.DISABLING)
        throw new ApolloError('sync_is_disabling')
      else if (ongoingSync.status === OutlookSyncStatusTypes.AUTHORIZING)
        throw new ApolloError('sync_is_authorizing')
      else throw new ApolloError('sync_is_still_running')
    }

    // check if there is another project  with the same calendar sync
    const projectFound = await models.Project.findById(projectId, 'outlook')

    if (projectFound.outlook && projectFound.outlook.calendarId) {

      const exisitingCalendarSync = await models.OutlookSync.findOne(
        {
          projectId: { $not: { $eq: projectId } },
          calendarId: projectFound.outlook.calendarId
        },
        'status'
      )
      loggerInfo({ exisitingCalendarSync })
      if (exisitingCalendarSync) throw new ApolloError('calendar already synced in another project')
    } else throw new ApolloError('Select calendar first')

    const outlookSyncFound = await models.OutlookSync.findOne(
      { projectId },
      'status'
    )

    if (outlookSyncFound) {
      let updateData = outlookSyncFound.status === OutlookSyncStatusTypes.FAILED_SYNCING
        ? { status: OutlookCalendarSyncStatus.DONE_TO_INITIALIZE }
        : {
          status: OutlookCalendarSyncStatus.READY_TO_INITIALIZE,
          nextLink: null,
          events: [],
          outlookEventIdsDeleted: [],
          singleEventsUpdated: [],
          seriesMasterEvents: [],
          seriesOccurrenceEvents: [],
          recentlyCreatedSeriesMasterEventsOutlookIds: [],
          ...projectFound.outlook && { calendarId: projectFound.outlook.calendarId }
        };


      await models.OutlookSync.updateOne(
        { _id: outlookSyncFound._id },
        {
          ...updateData,
          isFirstBatchInit: true,
          failedAt: null,
        }
      )

      loggerInfo({ outlookSyncFound })
      return outlookSyncFound._id

    } else {
      const outlookSyncId = mongoose.Types.ObjectId()
      await models.OutlookSync.create({
        _id: outlookSyncId,
        projectId,
        status: OutlookCalendarSyncStatus.READY_TO_INITIALIZE,
        createdAt: new Date(),
        userId: user.sub,
        isFirstBatchInit: true,
        ...projectFound.outlook && { calendarId: projectFound.outlook.calendarId }
      })
      return outlookSyncId
    }

  } catch (e) {
    loggerError('ERROR: readyToInitializeSync, ', { e })
    return e
  }
}

module.exports = {
  readyToInitializeSync,
}
