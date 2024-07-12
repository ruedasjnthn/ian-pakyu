const { getOutlookEventsFirstTime } = require('../../../../helper/OutlookEventHelper');
const { loggerInfo } = require('../../../../config/logger');
const { OutlookCalendarSyncStatus } = require('../../../../constants/outlook-calendar');

const firstInit = async ({
  client,
  calendarId,
  nextLink,
  models,
  outlookSyncId,
  projectId,
  start,
  projectCategories
}) => {
  const {
    outlookEventsResult,
    newNextLink,
    deltaLink,
    seriesMasterEvents,
  } = await getOutlookEventsFirstTime({
    client,
    calendarId,
    nextLink,
    projectCategories
  })

  const outlookEvRes = outlookEventsResult || []

  const outsync = await models.OutlookSync.updateOne(
    { _id: outlookSyncId, projectId },
    {
      status: newNextLink
        ? OutlookCalendarSyncStatus.READY_TO_INITIALIZE
        : OutlookCalendarSyncStatus.DONE_TO_INITIALIZE,
      nextLink: newNextLink || null,
      ...deltaLink && { newDeltaLink: deltaLink },
      initEndAt: new Date(),
      $addToSet: {
        seriesMasterEvents: { $each: seriesMasterEvents || [] },
        events: { $each: outlookEvRes }
      },
      isFirstBatchInit: false,
    }
  )

  loggerInfo('outSync', {
    outsync,
    status: newNextLink
      ? OutlookCalendarSyncStatus.READY_TO_INITIALIZE
      : OutlookCalendarSyncStatus.DONE_TO_INITIALIZE,
  })

  loggerInfo('success fetch', { totalTime: Date.now() - start, outlookSyncId, eventsLnght: outlookEvRes.length })

}

module.exports = {
  firstInit,
}
