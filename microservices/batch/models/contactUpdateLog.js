const mongoose = require("mongoose");
const { ContactLogActionTypesArray } = require('../constants/contact');
const { Schema } = mongoose;

const contactUpdateLogSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  outlookContactSyncId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  contactId: {
    type: Schema.Types.ObjectId,
  },
  action: {
    type: String,
    enum: ContactLogActionTypesArray,
  },
  date: {
    type: Date,
  },
  synced: {
    type: Boolean,
    default: false,
  },
  userId: {
    type: Schema.Types.ObjectId,
    required: true
  },
});

const ContactUpdateLog = mongoose.model("ContactUpdateLog", contactUpdateLogSchema, "col_ContactUpdateLogs");

module.exports = { ContactUpdateLog };
