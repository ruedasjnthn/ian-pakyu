
require('dotenv').config()

const DuplicateProjectJobStatusType = {
  // project details
  READY_TO_DUPLICATE_PROJECT_DETAILS: "ready_to_duplicate_project_details",
  DUPLICATING_PROJECT_DETAILS: "duplicating_project_details",
  DONE_TO_DUPLICATE_PROJECT_DETAILS: "done_to_duplicate_project_details",
  FAILED_TO_DUPLICATE_PROJECT_DETAILS: "failed_to_duplicate_project_details",

  // custom fields ids init
  READY_TO_INIT_CUSTOM_FIELDS_IDS: "ready_to_init_custom_fields_ids",
  INITIALIZING_CUSTOM_FIELDS_IDS: "initializing_custom_fields_ids",
  DONE_TO_INIT_CUSTOM_FIELDS_IDS: "done_to_init_custom_fields_ids",
  FAILED_TO_INIT_CUSTOM_FIELDS_IDS: "failed_to_init_custom_fields_ids",

  // custom fields
  READY_TO_DUPLICATE_CUSTOM_FIELDS: "ready_to_duplicate_custom_fields",
  DUPLICATING_CUSTOM_FIELDS: "duplicating_custom_fields",
  DONE_TO_DUPLICATE_CUSTOM_FIELDS: "done_to_duplicate_custom_fields",
  FAILED_TO_DUPLICATE_CUSTOM_FIELDS: "failed_to_duplicate_custom_fields",

  // project prefixes
  READY_TO_DUPLICATE_PROJECT_PREFIXES: "ready_to_duplicate_project_prefixes",
  DUPLICATING_PROJECT_PREFIXES: "duplicating_project_prefixes",
  DONE_TO_DUPLICATE_PROJECT_PREFIXES: "done_to_duplicate_project_prefixes",
  FAILED_TO_DUPLICATE_PROJECT_PREFIXES: "failed_to_duplicate_project_prefixes",

  // series master events
  READY_TO_DUPLICATE_SERIES_MASTER_EVENTS: "ready_to_duplicate_series_master_events",
  DUPLICATE_SERIES_MASTER_EVENTS: "duplicate_series_master_events",
  DONE_TO_DUPLICATE_SERIES_MASTER_EVENTS: "done_to_duplicate_series_master_events",
  FAILED_TO_DUPLICATE_SERIES_MASTER_EVENTS: "failed_to_duplicate_series_master_events",

  // events
  READY_TO_DUPLICATE_EVENTS: "ready_to_duplicate_events",
  DUPLICATING_EVENTS: "duplicating_events",
  DONE_TO_DUPLICATE_EVENTS: "done_to_duplicate_events",
  FAILED_TO_DUPLICATE_EVENTS: "failed_to_duplicate_events",

  // issues
  READY_TO_DUPLICATE_ISSUES: "ready_to_duplicate_issues",
  DUPLICATING_ISSUES: "duplicating_issues",
  DONE_TO_DUPLICATE_ISSUES: "done_to_duplicate_issues",
  FAILED_TO_DUPLICATE_ISSUES: "failed_to_duplicate_issues",

  // issue
  READY_TO_DUPLICATE_COMMENTS: "ready_to_duplicate_comments",
  DUPLICATING_COMMENTS: "duplicating_comments",
  DONE_TO_DUPLICATE_COMMENTS: "done_to_duplicate_comments",
  FAILED_TO_DUPLICATE_COMMENTS: "failed_to_duplicate_comments",

  SUCCESS_DUPLICATE: "success_duplicate",
}


const DuplicateProjectJobStatusTypeArray = Object.keys(
  DuplicateProjectJobStatusType
).map((k) => DuplicateProjectJobStatusType[k]);

const getDuplicateProjectJobStatusTypesWithKey = (key) => {
  const types = {};
  for (const status of DuplicateProjectJobStatusTypeArray) {
    types[String(status).toUpperCase()] = (key ? key + "_" : "") + status;
  }
  return types;
};

const isIjLocal = process.env.IJ_LOCAL === 'true';
const isDevIj = process.env.IJ_DEV === 'true';

// this is for production
let DuplicateProjectJobStatusTypeObj = DuplicateProjectJobStatusType;

// for ij local
if (isIjLocal)
  DuplicateProjectJobStatusTypeObj = getDuplicateProjectJobStatusTypesWithKey("ij_local");
if (isDevIj)
  DuplicateProjectJobStatusTypeObj = getDuplicateProjectJobStatusTypesWithKey("ij_dev");

// console.log({DuplicateProjectJobStatusTypeObj, });


const getDuplicateProjectJobStatusTypeArray = () => {
  return Object
    .keys(DuplicateProjectJobStatusTypeObj)
    .map((k) => DuplicateProjectJobStatusTypeObj[k]);
};

module.exports = {
  DuplicateProjectJobStatusType: DuplicateProjectJobStatusTypeObj,
  DuplicateProjectJobStatusTypes: getDuplicateProjectJobStatusTypeArray()
}
