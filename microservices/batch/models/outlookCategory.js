const mongoose = require("mongoose");
const { CategoryOrigin, OutlookCategoryPresetColorsArray } = require("../constants/category");
const { Schema } = mongoose;

const outlookCategoriesSchema = new Schema({
  displayName: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    enum: OutlookCategoryPresetColorsArray,
    required: true,
  },
  accountId: {
    type: String,
    required: true
  },
  outlookCategoryId: {
    type: String,
  },
  updatedNameCategoryId: {
    type: Schema.Types.ObjectId,
  },
  origin: {
    type: String,
    enum: CategoryOrigin,
    required: true
  },
  createdAt: {
    type: Date,
    required: true
  },
  updatedAt: {
    type: Date
  },
  deletedAt: {
    type: Date,
  },
  allowedGroups: {
    type: [Schema.Types.ObjectId],
    default: []
  },
  projectIdsExcludedInSync: {
    type: [Schema.Types.ObjectId],
    default: []
  }
})

const OutlookCategory = mongoose.model("OutlookCategory", outlookCategoriesSchema, "col_OutlookCategories");

module.exports = { OutlookCategory };
