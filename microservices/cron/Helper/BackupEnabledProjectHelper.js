const mongoose = require("mongoose");
const { Schema } = mongoose;

const backupEnabledProjectSchema = new Schema({
    projectId: {
      type: String,
      required: true
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    isBackedUp: {
      type: Boolean,
      default: false,
    },
    backupDate: {
      type: Date
    },
    updatedAt: {
      type: Date,
    }
  })

const BackupEnabledProject = mongoose.model("BackupEnabledProject", backupEnabledProjectSchema, "col_BackupEnabledProjects");

module.exports = { BackupEnabledProject };