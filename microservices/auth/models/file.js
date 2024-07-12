const mongoose = require('mongoose');
const { Schema } = mongoose;

const fileSchema = new Schema({
  projectId: {
    type: mongoose.Types.ObjectId,
  },
  userId: {
    type: mongoose.Types.ObjectId,
  },
  issueId: {
    type: mongoose.Types.ObjectId,
  },
  contactId: {
    type: mongoose.Types.ObjectId,
  },
  taskId: {
    type: Schema.Types.ObjectId,
  },
  oOfficeKey: {
    type: String,
  },
  type: {
    type: String,
  },
  size: {
    type: Number,
  },
  date: {
    type: Date,
  },
  fileName: {
    type: String,
  },
  blobPath: {
    type: String,
  },
  uploadFinished: {
    type: Boolean,
  },
  isFolder: {
    type: Boolean,
  },
  assigneeIds: {
    type: [mongoose.Types.ObjectId],
    default: [],
  },
  updatedAt: {
    type: Date,
  },
  sortingIndex: {
    type: Number,
  },
});

fileSchema.index({
  fileName: 'text',
});

const File = mongoose.model('File', fileSchema, 'col_UploadedFiles');

module.exports = { File };
