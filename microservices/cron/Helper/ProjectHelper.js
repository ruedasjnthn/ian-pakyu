const mongoose = require("mongoose");
const { Schema } = mongoose;

const prefixSchema = new Schema({
  title: { type: String, required: true },
  position: { type: Number, required: true },
  fieldId: { type: Schema.Types.ObjectId }
})

const eventCategorySchema = new Schema({
  title: {
    type: String,
    required: true
  },
  color: {
    type: String,
    required: true
  },
  outlookCategoryId: {
    type: String
  },
  outlookColor: {
    type: String
  }
});

const outlookSchema = new Schema({
  syncContactsEnabled: {
    type: Boolean,
    default: true
  },
  syncCalendarEnabled: {
    type: Boolean,
    default: true
  },
});

const projectSchema = new Schema({
  clientId: {
    type: mongoose.Types.ObjectId
  },
  name: {
    type: String,
    required: true,
    maxlength: [100, 'Name max length is 100']
  },
  syncEnabled: {
    type: Boolean,
    default: false,
  },
  timeZone: {
    type: String,
  },
  prefixes: {
    type: [prefixSchema]
  },
  eventCategories: {
    type: [eventCategorySchema]
  },
  filesTotalSize: {
    type: Number,
  },
  outlook: {
    type: outlookSchema
  },
  blobStorageSettings: {
    type: String
  },
  isCustomBlobStorageEnabled: {
    type: Boolean,
    default: false
  }
});


const Project = mongoose.model("Project", projectSchema, "col_Projects");

module.exports = { Project };
