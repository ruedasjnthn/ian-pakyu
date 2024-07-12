const mongoose = require("mongoose");
const { OutlookSyncStatusTypesArray } = require("../constants/outlook");
const { OutlookCalendarSyncStatus } = require("../constants/outlook-calendar");
const { eventSchema } = require("./event");
const { Schema } = mongoose;

const newlyCreatedSeriesEventsSchema = new Schema({
  seriesMasterId: { type: String },
  occurenceEvents: { type: [eventSchema], default: [] },
  fetchCompleted: { type: Boolean, default: false },
  synced: { type: Boolean, default: false },
  syncedOccEventsOutlookIds: { type: [String], default: [] }
})

const outlookSyncSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: OutlookCalendarSyncStatus,
  },
  calendarId: {
    type: String,
  },
  events: {
    type: [eventSchema],
    default: []
  },
  outlookEventIdsDeleted: {
    type: [String],
    default: []
  },
  singleEventsUpdated: {
    type: [eventSchema],
    default: []
  },
  seriesMasterEvents: {
    type: [eventSchema],
    default: []
  },
  seriesOccurrenceEvents: {
    type: [eventSchema],
    default: []
  },
  recentlyCreatedEventsOutlookIds: {
    type: [String],
    default: []
  },
  recentlyCreatedIssueEventsOutlookIds: {
    type: [String],
    default: []
  },
  recentlyCreatedSeriesMasterEventsOutlookIds: {
    type: [String],
    default: []
  },
  userId: {
    type: Schema.Types.ObjectId
  },
  nextLink: {
    type: String
  },
  deltaLink: {
    type: String
  },
  newDeltaLink: {
    type: String
  },
  isFirstSync: {
    type: Boolean,
    default: true
  },
  isFirstBatchInit: {
    type: Boolean,
  },
  createdAt: {
    type: Date
  },
  updatedAt: {
    type: Date,
  },
  initStartAt: {
    type: Date
  },
  initEndAt: {
    type: Date
  },
  syncStartAt: {
    type: Date
  },
  syncEndAt: {
    type: Date
  },
  lastSyncInitStartAt: {
    type: Date,
  },
  categoriesSyncedAt: {
    type: Date,
  },
  failedAt: {
    type: Date
  },
  errMessage: {
    type: String
  },
  logMessage: {
    type: String
  },
  // started: {
  //   type: Boolean,
  //   default: false
  // },
  // finished: {
  //   type: Boolean,
  //   default: false
  // },
  matchingEventsOutlookIds: {
    type: [String],
    default: []
  },
  matchedExceptionEventIds: {
    type: [String],
    default: []
  },
  // for sync-events in first sync and sync-new-issue-events in update sync
  syncedIssueEventsIds: {
    type: [Schema.Types.ObjectId],
    default: []
  },
  // for sync-events in first sync
  syncedEventsIds: {
    type: [Schema.Types.ObjectId],
    default: []
  },
  outlookEventsResultSynced: {
    type: [String],
    default: []
  },
  newlyCreatedSeriesEvents: {
    type: [newlyCreatedSeriesEventsSchema],
    default: []
  },
  newlyCreatedSeriesEventsToFetchNext: {
    seriesMasterOutlookId: { type: String, default: null },
    nextLink: { type: String, default: null }
  },
  checkedDeletedRecentlyCreatedEventsOutlookIds: {
    type: [String],
    default: []
  },
  syncedSingleEventsUpdatedOutlookIds: {
    type: [String],
    default: []
  },
  // sync-updated-events processed event obj ids
  syncedUpdatedEventsIds: {
    type: [Schema.Types.ObjectId],
    default: []
  },
  // sync-updated-issue-events processed event obj ids
  syncedUpdatedIssueEventsIds: {
    type: [Schema.Types.ObjectId],
    default: []
  },
  // delete-hidden-issue-events
  hiddenCustomFieldsSyncedIssuesIds: {
    type: [Schema.Types.ObjectId],
    default: []
  },
  masterSeriesEventsToUpdateInOlOutlookIds: {
    type: [String],
    default: []
  },
  masterSeriesEventsToUpdateInDbOutlookIds: {
    type: [String],
    default: []
  },
  syncedSeriesMasterEventsOutlookIds: {
    type: [String],
    default: []
  },
  eventCategorySyncedIds: {
    type: [Schema.Types.ObjectId],
    default: []
  },
  issueEventCategorySyncedIds: {
    type: [Schema.Types.ObjectId],
    default: []
  },
});


const OutlookSync = mongoose.model("OutlookSync", outlookSyncSchema, "col_OutlookSyncs");

module.exports = { OutlookSync };
