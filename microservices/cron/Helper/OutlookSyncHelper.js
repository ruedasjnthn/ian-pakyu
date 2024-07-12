const mongoose = require("mongoose");
const { OutlookSyncStatusTypesArray } = require("../constants/outlook");
const { Schema } = mongoose;

const eventSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  start: {
    type: Date,
    required: true,
  },
  end: {
    type: Date,
    required: true,
  },
  isAllDay: {
    type: Boolean,
    default: false
  },
  location: {
    type: String
  },
  notes: {
    type: String
  },
  categoryId: {
    type: Schema.Types.ObjectId,
  },
  outlookId: {
    type: String,
  },
  fromOutlook: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date
  },
  updatedAt: {
    type: Date
  },
  lastModifiedDateTime: {
    type: Date
  },
  deletedAt: {
    type: Date,
  },
})

const outlookSyncSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: OutlookSyncStatusTypesArray,
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
  createdAt: {
    type: Date
  },
  initStartAt: {
    type: Date
  },
  initEndAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  syncStartAt: {
    type: Date
  },
  syncEndAt: {
    type: Date
  },
  started: {
    type: Boolean,
    default: false
  },
  finished: {
    type: Boolean,
    default: false
  },
  isFirstBatchInit: {
    type: Boolean,
  },
  cronErrMessage: {
    type: String
  },
  cronRetryCount: {
    type: Number,
    default: 0
  },
});

const OutlookSync = mongoose.model("OutlookSync", outlookSyncSchema, "col_OutlookSyncs");

module.exports = {
  OutlookSync
}