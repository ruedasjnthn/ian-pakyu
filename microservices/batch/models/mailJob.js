const mongoose = require("mongoose");
const { MailJobStatusArray } = require("../constants/mailJob");
const { Schema } = mongoose;

const MailJobSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  mailId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  mailOutlookId: {
    type: String,
    required: true,
  },
  newMailOutlookId: {
    type: String,
  },
  targetProjectId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  targetProjectColumId: {
    type: Schema.Types.ObjectId,
  },
  status: {
    type: String,
    enum: MailJobStatusArray,
    required: true,
  },
  errorMessage: {
    type: String,
  },
  createdAt: {
    type: Date
  }
});

const MailJob = mongoose.model(
  "MailJob",
  MailJobSchema,
  "col_MailJobs"
);

module.exports = { MailJob }; 