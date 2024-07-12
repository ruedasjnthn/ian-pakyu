const mongoose = require("mongoose");
const { CalendarLogActionTypesArray } = require("../constants/calendar");
const { Schema } = mongoose;

const issueEventSchema = new Schema({
  issueId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  customFieldId: {
    type: Schema.Types.ObjectId,
    required: true
  },
})

const calendarUpdateLogSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  outlookSyncId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  eventId: {
    type: Schema.Types.ObjectId,
  },
  issueEvent: {
    type: issueEventSchema,
  },
  action: {
    type: String,
    enum: CalendarLogActionTypesArray,
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
  outlookId: {
    type: String
  }
});

const CalendarUpdateLog = mongoose.model("CalendarUpdateLog", calendarUpdateLogSchema, "col_CalendarUpdateLogs");

module.exports = { CalendarUpdateLog };
