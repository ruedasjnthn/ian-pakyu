const { getOutlookEventsChanges } = require('../../../../helper/OutlookEventHelper');
const { loggerInfo } = require('../../../../config/logger');
const { OutlookCalendarSyncStatus } = require('../../../../constants/outlook-calendar');

const updateInit = async ({
  projectCategories,
  client,
  outlookSyncFound,
  models,
  outlookSyncId,
  projectId,
  lastSyncInitStartAt
}) => {


  const {
    newNextLink,
    newDeltaLink,
    outlookEventIdsDeleted,
    singleEventsUpdated,
    seriesMasterEvents,
    seriesOccurrenceEvents
  } = await getOutlookEventsChanges({
    client,
    apiLink: outlookSyncFound.nextLink || outlookSyncFound.deltaLink,
    projectCategories
  })

  const outsync = await models.OutlookSync.updateOne(
    { _id: outlookSyncId, projectId },
    {
      status: newNextLink
        ? OutlookCalendarSyncStatus.READY_TO_INITIALIZE
        : OutlookCalendarSyncStatus.DONE_TO_INITIALIZE,
      // status: !newDeltaLink && newNextLink ? OutlookSyncStatusTypes.READY_TO_INITIALIZE : OutlookSyncStatusTypes.READY_TO_SYNC,
      // status: OutlookSyncStatusTypes.READY_TO_SYNC,
      nextLink: newNextLink || null,
      ...newDeltaLink && { newDeltaLink },
      initEndAt: new Date(),
      $addToSet: {
        outlookEventIdsDeleted: { $each: outlookEventIdsDeleted || [] },
        singleEventsUpdated: { $each: singleEventsUpdated || [] },
        seriesMasterEvents: { $each: seriesMasterEvents || [] },
        seriesOccurrenceEvents: { $each: seriesOccurrenceEvents || [] },
      },
      // lastSyncInitStartAt,
      isFirstBatchInit: false,
    }
  )

  loggerInfo('outSync', { outsync, })
}

module.exports = {
  updateInit,
}
