const { loggerError } = require("../../../../config/logger");
const { OutlookCalendarSyncStatus } = require("../../../../constants/outlook-calendar");

const prepSyncInit = async (_, { outlookSyncId, projectId }, { models }) => {
  try {

    // reset necessary fields
    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.DONE_TO_PREP_INIT,
        updatedAt: new Date(),
        isFirstBatchInit: true,

        failedAt: null,

        events: [],
        outlookEventIdsDeleted: [],
        singleEventsUpdated: [],
        seriesMasterEvents: [],
        seriesOccurrenceEvents: [],

        recentlyCreatedSeriesMasterEventsOutlookIds: [],
        // theses two are needed for checking its existence in outlook in sync-deleted-events
        // recentlyCreatedEventsOutlookIds: [],
        // recentlyCreatedIssueEventsOutlookIds: [],

        matchingEventsOutlookIds: [],
        matchedExceptionEventIds: [],
        syncedIssueEventsIds: [],
        syncedEventsIds: [],
        outlookEventsResultSynced: [],
        newlyCreatedSeriesEvents: [],
        newlyCreatedSeriesEventsToFetchNext: {
          seriesMasterOutlookId: null,
          nextLink: null,
        },
        checkedDeletedRecentlyCreatedEventsOutlookIds: [],
        syncedSingleEventsUpdatedOutlookIds: [],
        syncedUpdatedEventsIds: [],
        syncedUpdatedIssueEventsIds: [],
        hiddenCustomFieldsSyncedIssuesIds: [],
        masterSeriesEventsToUpdateInOlOutlookIds: [],
        masterSeriesEventsToUpdateInDbOutlookIds: [],
        syncedSeriesMasterEventsOutlookIds: [],
        eventCategorySyncedIds: [],
        issueEventCategorySyncedIds: [],
      }
    );

    return outlookSyncId
  } catch (err) {
    loggerError('prepSyncInit ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_PREP_INIT,
        updatedAt: new Date(),
        failedAt: new Date(),
        errMessage: err.message
      }
    );

    return err
  }
}

module.exports = {
  prepSyncInit
}
