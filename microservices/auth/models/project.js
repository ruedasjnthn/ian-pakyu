const mongoose = require('mongoose');
const { OutlookCategoryPresetColorsArray } = require('../constants/event');
const {
  ProjectCategoryArray,
  ProjectUserRoles,
  DefaultTimeZone,
} = require('../constants/projects');
const { Schema } = mongoose;

const disabledTableColumnSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true },
  dataKey: { type: String, required: true },
});

const userPositionSchema = new Schema({
  userId: Schema.Types.ObjectId,
  position: Number,
});

const columnSchema = new Schema({
  key: { type: String },
  title: { type: String },
  position: { type: Number },
  isPrivate: { type: Boolean, default: false },
  usersMinimized: { type: [Schema.Types.ObjectId] },
  usersHidColumn: { type: [Schema.Types.ObjectId] },
  userColPositions: { type: [userPositionSchema] },
  color: { type: String, default: '#FF0000' },
});

const prefixSchema = new Schema({
  title: { type: String, required: true },
  position: { type: Number, required: true },
  fieldId: { type: Schema.Types.ObjectId },
});

const userSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  email: String,
  role: {
    type: String,
    enum: ProjectUserRoles,
  },
  token: String,
  status: {
    type: Boolean,
    default: true,
  },
});

const eventCategorySchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  color: {
    type: String,
  },
  // id of category from col_outlookCategory
  categoryId: {
    type: Schema.Types.ObjectId,
  },
  // id of category from outlook
  outlookCategoryId: {
    type: String,
  },
  outlookColor: {
    type: String,
  },
  presetColor: {
    type: String,
    enum: OutlookCategoryPresetColorsArray,
  },
  deletedAt: {
    type: Date,
  },
  allowedGroups: {
    type: [Schema.Types.ObjectId],
    default: [],
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
  syncContactsEnabled: {
    type: Boolean,
    default: true,
  },
  syncCalendarEnabled: {
    type: Boolean,
    default: true,
  },
  syncMailEnabled: {
    type: Boolean,
    default: true,
  },
  accountId: {
    type: String,
  },
});

const userGroupSchema = new Schema({
  name: { type: String, required: true, maxlength: 50 },
  userIds: { type: [Schema.Types.ObjectId], default: [] },
  createdBy: { type: Schema.Types.ObjectId, required: true },
  updatedAt: { type: Date },
  hideColumnView: { type: Boolean, default: false },
  hideTableView: { type: Boolean, default: false },
  hideCalendarView: { type: Boolean, default: false },
  hideContacts: { type: Boolean, default: false },
  hideAttachments: { type: Boolean, default: false },
});

const projectSchema = new Schema({
  clientId: {
    type: mongoose.Types.ObjectId,
  },
  name: {
    type: String,
    required: true,
    maxlength: [100, 'Name max length is 100'],
  },
  url: {
    type: String,
  },
  description: {
    type: String,
  },
  category: {
    type: String,
    enum: ProjectCategoryArray,
  },
  createdAt: {
    type: Date,
  },
  updatedAt: {
    type: Date,
  },
  users: {
    type: [userSchema],
    default: [],
  },
  columns: {
    type: [columnSchema],
  },
  prefixes: {
    type: [prefixSchema],
  },
  eventCategories: {
    type: [eventCategorySchema],
  },
  syncEnabled: {
    type: Boolean,
    default: false,
  },
  timeZone: {
    type: String,
    default: DefaultTimeZone,
  },
  outlook: {
    type: outlookSchema,
  },
  calendarTimeMin: {
    type: String,
  },
  calendarTimeMax: {
    type: String,
  },
  issueCreateDisabled: {
    type: Boolean,
    default: false,
  },
  issueDeleteDisabled: {
    type: Boolean,
    default: false,
  },
  issuePrintIconDisabled: {
    type: Boolean,
    default: false,
  },
  eventSenderEmail: {
    type: String,
  },
  eventSenderName: {
    type: String,
  },
  filesTotalSize: {
    type: Number,
  },
  issueColor: {
    type: String,
    default: '#FFF',
  },
  disabledTableColumns: {
    type: [disabledTableColumnSchema],
    default: [],
  },
  mailSubscribed: {
    type: Boolean,
    default: false,
  },
  userColumnPositionEnabled: {
    type: Boolean,
  },
  autoEnabledOCR: {
    type: Boolean,
  },
  userPositions: {
    type: [userPositionSchema],
    default: [],
  },
  userGroups: {
    type: [userGroupSchema],
    default: [],
  },
  defaultMainIssues: {
    type: [Schema.Types.ObjectId],
    default: [],
  },
  outlookEmailColumnEnabled: {
    type: Boolean,
    default: false,
  },
  selectedOutlookEmailsColumn: {
    type: String,
  },
  includeMainIssueTitleToSubIssueTitle: {
    type: Boolean,
    default: false,
  },
  onlyVisibleToOwner: {
    type: Boolean,
    default: false,
  },
});

const Project = mongoose.model('Project', projectSchema, 'col_Projects');

module.exports = { Project };
