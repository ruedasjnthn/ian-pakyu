const mongoose = require("mongoose");
const { Schema } = mongoose;

const backupSchema = new Schema({
    projectId: {
      type: String
    },
    filepath: {
      type: String
    },
    ftpDir: {
      type: String
    },
    backupDate: {
      type: Date
    },
  })

const Backup = mongoose.model("Backup", backupSchema, "col_Backups");

module.exports = { Backup };