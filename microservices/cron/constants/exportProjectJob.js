
require('dotenv').config()

const ExportProjectJobStatusType = {
  // project details
  READY_TO_EXPORT_PROJECT_DETAILS: "ready_to_export_project_details",
  EXPORTING_PROJECT_DETAILS: "exporting_project_details",
  DONE_TO_EXPORT_PROJECT_DETAILS: "done_to_export_project_details",
  FAILED_TO_EXPORT_PROJECT_DETAILS: "failed_to_export_project_details",

  // custom fields ids init
  READY_TO_INIT_CUSTOM_FIELDS_IDS: "ready_to_init_custom_fields_ids",
  INITIALIZING_CUSTOM_FIELDS_IDS: "initializing_custom_fields_ids",
  DONE_TO_INIT_CUSTOM_FIELDS_IDS: "done_to_init_custom_fields_ids",
  FAILED_TO_INIT_CUSTOM_FIELDS_IDS: "failed_to_init_custom_fields_ids",

  // custom fields
  READY_TO_EXPORT_CUSTOM_FIELDS: "ready_to_export_custom_fields",
  EXPORTING_CUSTOM_FIELDS: "exporting_custom_fields",
  DONE_TO_EXPORT_CUSTOM_FIELDS: "done_to_export_custom_fields",
  FAILED_TO_EXPORT_CUSTOM_FIELDS: "failed_to_export_custom_fields",

  // project prefixes
  READY_TO_EXPORT_PROJECT_PREFIXES: "ready_to_export_project_prefixes",
  EXPORTING_PROJECT_PREFIXES: "exporting_project_prefixes",
  DONE_TO_EXPORT_PROJECT_PREFIXES: "done_to_export_project_prefixes",
  FAILED_TO_EXPORT_PROJECT_PREFIXES: "failed_to_export_project_prefixes",

  // series master events
  READY_TO_EXPORT_SERIES_MASTER_EVENTS: "ready_to_export_series_master_events",
  EXPORTING_SERIES_MASTER_EVENTS: "exporting_series_master_events",
  DONE_TO_EXPORT_SERIES_MASTER_EVENTS: "done_to_export_series_master_events",
  FAILED_TO_EXPORT_SERIES_MASTER_EVENTS: "failed_to_export_series_master_events",

  // events
  READY_TO_EXPORT_EVENTS: "ready_to_export_events",
  EXPORTING_EVENTS: "exporting_events",
  DONE_TO_EXPORT_EVENTS: "done_to_export_events",
  FAILED_TO_EXPORT_EVENTS: "failed_to_export_events",

  // issues
  READY_TO_EXPORT_ISSUES: "ready_to_export_issues",
  EXPORTING_ISSUES: "exporting_issues",
  DONE_TO_EXPORT_ISSUES: "done_to_export_issues",
  FAILED_TO_EXPORT_ISSUES: "failed_to_export_issues",

  // comments
  READY_TO_EXPORT_COMMENTS: "ready_to_export_comments",
  EXPORTING_COMMENTS: "exporting_comments",
  DONE_TO_EXPORT_COMMENTS: "done_to_export_comments",
  FAILED_TO_EXPORT_COMMENTS: "failed_to_export_comments",

  // finish
  READY_TO_FINISH_EXPORT_PROJECT: "ready_to_finish_export_project",
  FINISHING_EXPORT_PROJECT: "finishing_export_project ",
  DONE_TO_FINISH_EXPORT_PROJECT: "done_to_finish_export_project",
  FAILED_TO_FINISH_EXPORT_PROJECT: "failed_to_finish_export_project",

  SUCCESS_EXPORT: "success_export",
}


const ExportProjectJobStatusTypeArray = Object.keys(
  ExportProjectJobStatusType
).map((k) => ExportProjectJobStatusType[k]);

const getExportProjectJobStatusTypesWithKey = (key) => {
  const types = {};
  for (const status of ExportProjectJobStatusTypeArray) {
    types[String(status).toUpperCase()] = (key ? key + "_" : "") + status;
  }
  return types;
};

const isIjLocal = process.env.IJ_LOCAL === 'true';
const isDevIj = process.env.IJ_DEV === 'true';

// this is for production
let ExportProjectJobStatusTypeObj = ExportProjectJobStatusType;

// for ij local
if (isIjLocal) 
  ExportProjectJobStatusTypeObj = getExportProjectJobStatusTypesWithKey("ij_local");
if (isDevIj)
  ExportProjectJobStatusTypeObj = getExportProjectJobStatusTypesWithKey("ij_dev");


const getExportProjectJobStatusTypeArray = () => {
  return Object
    .keys(ExportProjectJobStatusTypeObj)
    .map((k) => ExportProjectJobStatusTypeObj[k]);
};



const ExportProjectJobLimits = {
  CUSTOM_FIELD_ID: 100,
  CUSTOM_FIELD: 100,
  SERIES_MASTER_EVENT: 200,
  EVENT: 200,
  ISSUE: 200,
  COMMENT: 300,
}

module.exports = {
  ExportProjectJobStatusType: ExportProjectJobStatusTypeObj,
  ExportProjectJobStatusTypes: getExportProjectJobStatusTypeArray(),
  ExportProjectJobLimits
}

