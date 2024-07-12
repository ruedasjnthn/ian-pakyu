const mongoose = require("mongoose");
const { OutlookEventTypesArray, DaysOfWeekArray, RecurrenceIndexArray, RecurrenceTypesArray, RecurrenceRangeTypeArray, SensitivityTypesArray, SensitivityTypes, ShowAsTypesArray, ShowAsTypes } = require("../constants/outlook");
const { Schema } = mongoose;

const recurrenceSchema = new Schema({
  pattern: {
    type: {
      type: String,
      enum: RecurrenceTypesArray,
    },
    interval: {
      type: Number
    },
    month: {
      type: Number
    },
    dayOfMonth: {
      type: Number
    },
    daysOfWeek: {
      type: [String],
      enum: DaysOfWeekArray
    },
    firstDayOfWeek: {
      type: String,
      enum: DaysOfWeekArray
    },
    index: {
      type: String,
      enum: RecurrenceIndexArray
    }
  },
  range: {
    type: {
      type: String,
      enum: RecurrenceRangeTypeArray
    },
    startDate: {
      type: String
    },
    endDate: {
      type: String
    },
    recurrenceTimeZone: {
      type: String
    },
    numberOfOccurrences: {
      type: Number
    }
  }
});

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
  seriesMasterId: {
    type: String,
  },
  type: {
    type: String,
    enum: OutlookEventTypesArray,
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
  recurrence: {
    type: recurrenceSchema
  },
  isRecurrenceEditable: {
    type: Boolean
  },
  userIds: {
    type: [Schema.Types.ObjectId],
    ref: 'User',
    default: []
  },
  sensitivity: {
    type: String,
    enum: SensitivityTypesArray,
    default: SensitivityTypes.NORMAL
  },
  showAs: {
    type: String,
    enum: ShowAsTypesArray,
    default: ShowAsTypes.BUSY
  },
  timeZone: {
    type: String
  },
})

eventSchema.index({
  title: 'text',
});

const Event = mongoose.model("Event", eventSchema, "col_Events");

module.exports = { Event, eventSchema };
