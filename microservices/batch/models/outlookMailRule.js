const mongoose = require("mongoose");
const { Schema } = mongoose;

const outlookMailRuleSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  accountId: {
    type: String,
    required: true,
  },
  targetProjectId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  targetEmailAddress: {
    type: String,
    required: true,
  },
});

const OutlookMailRule = mongoose.model(
  "OutlookMailRule",
  outlookMailRuleSchema,
  "col_OutlookMailRules"
);

module.exports = { OutlookMailRule };