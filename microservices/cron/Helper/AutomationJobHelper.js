const mongoose = require("mongoose");
const { AutomationActionTypesArray, AutomationJobStatusArray } = require("../constants/automation");
const { Schema } = mongoose;

const automationJobSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  issueId: {
    type: Schema.Types.ObjectId,
    ref: 'Issue'
  },
  automationId: {
    type: Schema.Types.ObjectId,
    ref: 'Automation'
  },
  action: {
    type: String,
    required: true,
    enum: AutomationActionTypesArray,
  },
  status: {
    type: String,
    enum: AutomationJobStatusArray
  },
  timeToExecute: {
    type: Date,
  },
  isInstant: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
  },
});

const AutomationJob = mongoose.model("AutomationJob", automationJobSchema, "col_AutomationJobs");

module.exports = { AutomationJob };
