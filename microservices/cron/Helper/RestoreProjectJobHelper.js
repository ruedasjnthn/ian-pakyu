const mongoose = require("mongoose");
const { Schema } = mongoose;

const restoreProjectSchema = new Schema({
    projectId: {
      type: String
    },
    filepath: {
      type: String
    },
    restoreDate: {
      type: Date
    },
    isRestored: {
      type: Boolean,
      default: false
    }
  })

const RestoreProject = mongoose.model("RestoreProject", restoreProjectSchema, "col_RestoreProjects");

module.exports = { RestoreProject };
