const mongoose = require("mongoose");
const { OutlookCategoryPresetColorsArray } = require("../constants/category");
const { OutlookCategoryColors } = require("../constants/outlook");
const { Schema } = mongoose;

const optionSchema = new Schema({
  label: {
    type: String,
    required: true
  },
  selected: {
    type: Boolean
  },
})

const emailInviteSchema = new Schema({
  emailFieldId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  text: {
    type: String,
  },
  cancelSubject: {
    type: String,
  },
  cancelText: {
    type: String,
  },
})

const additionalDurationSchema = new Schema({
  fieldId: { type: Schema.Types.ObjectId, required: true },
  duration: { type: Number, required: true, default: 0 }
})

const customFieldSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  tip: {
    type: String
  },
  defaultValue: {
    type: String
  },
  position: {
    type: Number
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  options: {
    type: [optionSchema]
  },
  emailInvite: {
    type: emailInviteSchema
  },
  quickFilter: {
    type: Boolean,
    default: false
  },
  showOnFile: {
    type: Boolean,
    default: true
  },
  isBirthday: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date
  },
  updatedAt: {
    type: Date
  },
  deletedAt: {
    type: Date,
  },
  additionalDurations: {
    type: [additionalDurationSchema]
  },
  presetColor: {
    type: String,
    enum: OutlookCategoryPresetColorsArray
  },
  categoryId: {
    type: Schema.Types.ObjectId
  },
  hideFromCalendar: {
    type: Boolean,
    default: false
  },
})

const CustomField = mongoose.model("CustomField", customFieldSchema, "col_CustomFields");

module.exports = { CustomField };
