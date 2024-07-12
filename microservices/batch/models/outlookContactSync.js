const mongoose = require("mongoose");
const { OutlookSyncStatusTypesArray } = require("../constants/outlook");
const { contactSchema } = require("./contact");
const { Schema } = mongoose;

const outlookContactSyncSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: OutlookSyncStatusTypesArray,
  },
  contacts: {
    type: [contactSchema],
    default: []
  },
  outlookContactIdsDeleted: {
    type: [String],
    default: []
  },
  outlookContactsUpdated: {
    type: [contactSchema],
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
});


const OutlookContactSync = mongoose.model("OutlookContactSync", outlookContactSyncSchema, "col_OutlookContactSyncs");

module.exports = { OutlookContactSync };
