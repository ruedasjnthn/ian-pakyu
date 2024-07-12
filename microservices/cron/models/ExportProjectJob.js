const mongoose = require("mongoose");
const { ExportProjectJobStatusTypes } = require("../constants/exportProjectJob");
const { Schema } = mongoose;

const newIdSchema = new Schema({
  origId: mongoose.Schema.ObjectId,
  newId: mongoose.Schema.ObjectId,
  outlookId: String,
})

const exportProjectJobSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  status: {
    type: String,
    enum: ExportProjectJobStatusTypes,
    required: true,
  },
  userGroupsIds: {
    type: [newIdSchema],
    default: [],
  },
  projectEventCategoriesIds: {
    type: [newIdSchema],
    default: [],
  },
  columnsIds: {
    type: [newIdSchema],
    default: [],
  },
  customFieldsIds: {
    type: [newIdSchema],
    default: [],
  },
  duplicatedCustomFieldsOrigIds: {
    type: [Schema.Types.ObjectId],
    default: [],
  },
  prefixesIds: {
    type: [newIdSchema],
    default: [],
  },
  seriesMasterEventsIds: {
    type: [newIdSchema],
    default: [],
  },
  eventsIds: {
    type: [newIdSchema],
    default: [],
  },
  issuesIds: {
    type: [newIdSchema],
    default: [],
  },
  commentsIds: {
    type: [newIdSchema],
    default: [],
  },
  // user exported the project
  duplicatedBy: {
    type: Schema.Types.ObjectId
  },
  createdAt: {
    type: Date,
    required: true
  },
  startedAt: {
    type: Date
  },
  updatedAt: {
    type: Date
  },
  finishedAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  errorMessage: {
    type: String
  },
  failedAtTimes: {
    type: [Date]
  },
  jsonFolderPath: {
    type: String
  },
  zipBlobPath: {
    type: String
  },
});

const ExportProjectJob = mongoose.model(
  "ExportProjectJob",
  exportProjectJobSchema,
  "col_ExportProjectJobs"
);

module.exports = { ExportProjectJob };
