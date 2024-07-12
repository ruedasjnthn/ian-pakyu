const mongoose = require('mongoose');
const { OutlookEventTypes, CalendarSyncRange, CalendarRangeFilter, } = require('../../../../constants/outlook');
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, getProjectCustomFields } = require('../../../../helper/OutlookSyncHelper');
const { OutlookCalendarSyncStatus } = require('../../../../constants/outlook-calendar');
const { ApolloError } = require('apollo-server-express');


// delete Synced Events
const deleteSyncedEvents = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.DELETING_EVENTS
    })

    const { dateCustomFieldsIds } = await getProjectCustomFields({ models, projectId })

    const outlookSyncFound = await models.OutlookSync.findById(outlookSyncId, 'outlookEventIdsDeleted')
    if (!outlookSyncFound) throw new ApolloError('outlook_sync_not_found')

    const deletedOutlookIds = outlookSyncFound.outlookEventIdsDeleted || [];

    if (deletedOutlookIds.length > 0) {
      const seriesMasterToDelete = await models.Event.find(
        {
          projectId,
          outlookId: { $in: deletedOutlookIds },
          ...CalendarRangeFilter
        },
        'id'
      )
      const seriesMasterToDeleteLength = seriesMasterToDelete.length
      const seriesMasterToDeleteIds = seriesMasterToDelete.map(e => String(e._id))

      await models.Event.updateMany(
        {
          projectId,
          $and: [
            {
              $or: [
                { outlookId: { $in: deletedOutlookIds } },
                { seriesMasterId: { $in: deletedOutlookIds } },
                { seriesMasterId: { $in: seriesMasterToDeleteIds } }
              ],
            },
            { ...CalendarRangeFilter }
          ]
        },
        {
          deletedAt: new Date(),
        }
      )

      if (seriesMasterToDeleteLength > 0) {
        await models.Event.deleteMany({
          projectId,
          seriesMasterId: { $in: seriesMasterToDeleteIds },
          type: OutlookEventTypes.OCCURRENCE,
        })

        await models.Event.deleteMany({
          projectId,
          seriesMasterId: { $in: seriesMasterToDeleteIds },
          type: OutlookEventTypes.EXCEPTION,
        })
      }

      if (
        dateCustomFieldsIds.length > 0 &&
        deletedOutlookIds.length > 0
      ) {
        await models.Issue.updateMany(
          {
            projectId: mongoose.Types.ObjectId(projectId),
            issueCustomFields: {
              $elemMatch: {
                fieldId: { $in: dateCustomFieldsIds },
                outlookId: { $in: deletedOutlookIds },
                $and: [
                  { value: { $gte: CalendarSyncRange.getStart() } },
                  { value: { $lte: CalendarSyncRange.getEnd() } }
                ]
              }
            }
          },
          { $set: { "issueCustomFields.$.outlookId": null } }
        );
      }

    }

    loggerInfo('deleteSyncedEvents', { deletedOutlookIds, deletedOutlookIds, dateCustomFieldsIds, })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.DONE_TO_DELETE_EVENTS,
        updatedAt: new Date(),
      }
    );

    return outlookSyncId

  } catch (err) {
    loggerError('deleteSyncedEvents ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_DELETE_EVENTS,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err

  }
}

module.exports = {
  deleteSyncedEvents
}
