const mongoose = require("mongoose");
const { DuplicateProjectJobStatusTypes } = require("../constants/duplicateProjectJob");
const { Schema } = mongoose;

const newIdSchema = new Schema({
  origId: mongoose.Schema.ObjectId,
  newId: mongoose.Schema.ObjectId,
  outlookId: String,
})

const duplicateProjectJobSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  newProjectId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  status: {
    type: String,
    enum: DuplicateProjectJobStatusTypes,
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
  // user duplicated the project
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
});

const DuplicateProjectJob = mongoose.model(
  "DuplicateProjectJob",
  duplicateProjectJobSchema,
  "col_DuplicateProjectJobs"
);

module.exports = { DuplicateProjectJob };
