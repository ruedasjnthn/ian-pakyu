const mongoose = require("mongoose");
const { OutlookCategoryPresetColorsArray } = require("../constants/category");
const { OutlookCategoryColors } = require("../constants/outlook");
const { ProjectUserRoles } = require("../constants/project");
const { Schema } = mongoose;

const prefixSchema = new Schema({
  title: { type: String, required: true },
  position: { type: Number, required: true },
  fieldId: { type: Schema.Types.ObjectId }
})

const userPositionSchema = new Schema({
  userId: Schema.Types.ObjectId,
  position: Number,
})

const columnSchema = new Schema({
  key: { type: String },
  title: { type: String },
  position: { type: Number },
  isPrivate: { type: Boolean, default: false },
  usersMinimized: { type: [Schema.Types.ObjectId] },
  usersHidColumn: { type: [Schema.Types.ObjectId] },
  userColPositions: { type: [userPositionSchema] },
  color: { type: String, default: '#FF0000' },
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
  // id of category from col_outlookCategory
  categoryId: {
    type: Schema.Types.ObjectId
  },
  // id of category from outlook
  outlookCategoryId: {
    type: String
  },
  outlookColor: {
    type: String,
  },
  presetColor: {
    type: String,
    enum: OutlookCategoryPresetColorsArray,
  },
  deletedAt: {
    type: Date
  },
  allowedGroups: {
    type: [Schema.Types.ObjectId],
    default: [],
  },
  excludeInSync: {
    type: Boolean,
    default: false,
  },
});

const outlookSchema = new Schema({
  accessToken: {
    type: String,
  },
  refreshToken: {
    type: String,
  },
  calendarId: {
    type: String,
  },
  contactId: {
    type: String
  },
  syncContactsEnabled: {
    type: Boolean,
    default: false
  },
  syncCalendarEnabled: {
    type: Boolean,
    default: true
  },
  syncMailEnabled: {
    type: Boolean,
    default: false,
  },
  accountId: {
    type: String
  },
  accountMail: {
    type: String
  },
  accountName: {
    type: String
  },
  authErrorAt: {
    type: Date
  },
  mailFolderId: {
    type: String
  }
});

const userSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }, 
  role: {
    type: String,
    enum: ProjectUserRoles
  },
  status: {
    type: Boolean,
    default: true
  },
})

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
  columns: {
    type: [columnSchema],
    default: []
  },
  timeZone: {
    type: String,
  },
  outlook: {
    type: outlookSchema,
  },
  prefixes: {
    type: [prefixSchema]
  },
  eventCategories: {
    type: [eventCategorySchema]
  },
  contactSyncEnabled: {
    type: Boolean,
    default: false,
  },
  users: {
    type: [userSchema],
    default: []
  },
  mailSubscribed: {
    type: Boolean,
    default: false
  },
  selectedOutlookEmailsColumn: {
    type: String,
  },
  outlookEmailColumnEnabled: {
    type: Boolean,
    default: false
  },
  updatedAt: {
    type: Date,
  },
});


const Project = mongoose.model("Project", projectSchema, "col_Projects");

module.exports = { Project };
