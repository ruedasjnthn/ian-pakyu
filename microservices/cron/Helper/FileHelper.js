const mongoose = require("mongoose");
const { Schema } = mongoose;

const fileSchema = new Schema({
  projectId: {
    type: mongoose.Types.ObjectId
  },
  userId: {
    type: mongoose.Types.ObjectId
  },
  issueId: {
    type: mongoose.Types.ObjectId
  },
  type: {
    type: String
  },
  size: {
    type: Number
  },
  date: {
    type: Date
  },
  fileName: {
    type: String
  },
  blobPath: {
    type: String
  },
  uploadFinished: {
    type: Boolean
  },
  isFolder: {
    type: Boolean
  },
  migratedToCustomBlobStorageStatus: {
    type: String
  },
});

const File = mongoose.model("File", fileSchema, "col_UploadedFiles");

module.exports = { File };
