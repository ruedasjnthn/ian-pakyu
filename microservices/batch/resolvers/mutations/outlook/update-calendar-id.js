const { getClientWithUpdateToken } = require('../../../helper/AuthHelper');
const { deleteOutlookEvent } = require('../../../helper/OutlookEventHelper');
const { getOutlookEventsIdsToDeleteInOutlookFromAktenplatz } = require('../../../helper/EventHelper');
const { ApolloError } = require('apollo-server-express');
const { loggerInfo } = require('../../../config/logger');
const { OutlookSyncStatusTypes } = require('../../../constants/outlook');

const updateProjectCalendarId = async (_, { projectId, calendarId: newCalendarId }, { models }) => {
  try {
    const ongoingSync = await models.OutlookSync.findOne({
      projectId,
      status: {
        $in: [
          OutlookSyncStatusTypes.INITIALIZING,
          OutlookSyncStatusTypes.PENDING,
          OutlookSyncStatusTypes.READY_TO_INITIALIZE,
          OutlookSyncStatusTypes.READY_TO_SYNC,
          OutlookSyncStatusTypes.SYNCING,
          OutlookSyncStatusTypes.DISABLING,
          OutlookSyncStatusTypes.AUTHORIZING,
          OutlookSyncStatusTypes.FAILED_FIRST_SYNCING,
          OutlookSyncStatusTypes.FAILED_FIRST_INITIALIZING,
        ]
      }
    }, 'id status')

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

    const projectWithSameCalendar = await models.Project.findOne({
      'outlook.calendarId': newCalendarId,
      _id: { $not: { $eq: projectId } }
    })
    loggerInfo({ projectWithSameCalendar })
    if (projectWithSameCalendar) throw new ApolloError('calendar_already_selected')

    const projectFound = await models.Project.findById(projectId, 'outlook')

    const project = projectFound && projectFound.outlook || {}
    const { calendarId, accessToken, refreshToken } = project

    if (calendarId !== newCalendarId) {

      await models.OutlookSync.deleteMany({ projectId })

      const updatedProject = await models.Project.updateOne(
        { _id: projectId },
        { $set: { 'outlook.calendarId': newCalendarId } }
      )

      const outlookIdsToDelete = await getOutlookEventsIdsToDeleteInOutlookFromAktenplatz(
        models,
        projectId
      )

      const client = await getClientWithUpdateToken({ projectId, accessToken, models, refreshToken })

      for (const outlookId of outlookIdsToDelete) {
        const deleted = await deleteOutlookEvent(
          client,
          outlookId
        )
        loggerInfo({ deleted })
      }

      if (outlookIdsToDelete && updatedProject.modifiedCount) {

        // TODO: fix outlookID
        await models.Event.bulkWrite([
          // { deleteMany: { filter: { projectId: projectFound._id, fromOutlook: true } } },
          { updateMany: { filter: { projectId: projectFound._id }, update: { outlookId: null } } }
        ])

        await models.Issue.updateMany(
          { projectId },
          { $set: { "issueCustomFields.$[elem].outlookId": null } },
          { arrayFilters: [{ "elem.outlookId": { $ne: null } }] }
        )

        return 'updated_read_to_sync'

      }

    }

    return 'same_calendar'
  }
  catch (e) {
    return e
  }
};

module.exports = {
  updateProjectCalendarId,
}
