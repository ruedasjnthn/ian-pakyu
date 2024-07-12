const mongoose = require("mongoose");
const { Schema } = mongoose;

const issueCustomFieldsSchema = new Schema({
  fieldId: Schema.Types.ObjectId,
  value: String,
  uid: Schema.Types.ObjectId,
  outlookId: String,
  isAllDay: Boolean,
})

const issueSchema = new Schema({
  title: {
    type: String,
    maxlength: [40, "Title Max length is 40"],
  },
  type: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
  priority: {
    type: String,
    required: true,
  },
  listPosition: {
    type: Number,
    required: true,
  },
  description: {
    type: String
  },
  estimate: {
    type: Number
  },
  timeSpent: {
    type: Number
  },
  timeRemaining: {
    type: Number
  },
  createdAt: {
    type: Date
  },
  updatedAt: {
    type: Date,
  },
  deletedAt: {
    type: Date,
  },
  reporterId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  userIds: {
    type: [Schema.Types.ObjectId],
    ref: 'User'
  },
  issueCustomFields: {
    type: [issueCustomFieldsSchema]
  },
  fileId: {
    type: String
  },
  fileId: {
    type: String
  },
  archived: {
    type: Boolean,
  },
  updatedPrefixAt: {
    type: Date
  }
});

const Issue = mongoose.model("Issue", issueSchema, "col_Issues");

module.exports = { Issue };
