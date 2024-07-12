require("dotenv").config();

const OutlookCalendarSyncStatus = {

  // prep init
  READY_TO_PREP_INIT: "ready_to_prep_init",
  PREPPING_INIT: "prepping_init",
  DONE_TO_PREP_INIT: "done_to_prep_init",
  FAILED_TO_PREP_INIT: "failed_to_prep_init",

  // initialize sync
  READY_TO_INITIALIZE: 'ready_to_initialize',
  INITIALIZING: 'initializing',
  DONE_TO_INITIALIZE: 'done_to_initialize',
  FAILED_INITIALIZING: 'failed_initializing',

  // --------------
  // syncing first process

  // sync issue events
  READY_TO_SYNC_ISSUE_EVENTS: "ready_to_sync_issue_events",
  SYNCING_ISSUE_EVENTS: "syncing_issue_events",
  DONE_TO_SYNC_ISSUE_EVENTS: "done_to_sync_issue_events",
  FAILED_TO_SYNC_ISSUE_EVENTS: "failed_to_sync_issue_events",

  // sync events
  READY_TO_SYNC_EVENTS: "ready_to_sync_events",
  SYNCING_EVENTS: "syncing_events",
  DONE_TO_SYNC_EVENTS: "done_to_sync_events",
  FAILED_TO_SYNC_EVENTS: "failed_to_sync_events",

  // sync series events
  READY_TO_SYNC_SERIES_EVENTS: "ready_to_sync_series_events",
  SYNCING_SERIES_EVENTS: "syncing_series_events",
  DONE_TO_SYNC_SERIES_EVENTS: "done_to_sync_series_events",
  FAILED_TO_SYNC_SERIES_EVENTS: "failed_to_sync_series_events",

  // fetching the newly created outlook series events from syncing
  READY_TO_FETCH_NEW_OUTLOOK_SERIES_EVENTS: "ready_to_fetch_new_outlook_series_events",
  FETCHING_NEW_OUTLOOK_SERIES_EVENTS: "fetching_new_outlook_series_events",
  DONE_TO_FETCH_NEW_OUTLOOK_SERIES_EVENTS: "done_to_fetch_new_outlook_series_events",
  FAILED_TO_FETCH_NEW_OUTLOOK_SERIES_EVENTS: "failed_to_fetch_new_outlook_series_events",

  // syncing the newly created outlook series events from syncing
  READY_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS: "ready_to_sync_new_outlook_series_events",
  SYNCING_NEW_OUTLOOK_SERIES_EVENTS: "syncing_new_outlook_series_events",
  DONE_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS: "done_to_sync_new_outlook_series_events",
  FAILED_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS: "failed_to_sync_new_outlook_series_events",

  READY_TO_FINISH_FIRST_SYNC: "ready_to_finish_first_sync",
  FINISHING_FIRST_SYNC: "finishing_first_sync",
  FAILED_TO_FINISH_FIRST_SYNC: "failed_to_finish_first_sync",
  SUCCESS: "success",

  // --------------
  // sync update process

  READY_TO_SYNC_DELETED_EVENTS: "ready_to_sync_deleted_events",
  SYNCING_DELETED_EVENTS: "syncing_deleted_events",
  DONE_TO_SYNC_DELETED_EVENTS: "done_to_sync_deleted_events",
  FAILED_TO_SYNC_DELETED_EVENTS: "failed_to_sync_deleted_events",

  READY_TO_SYNC_OUTLOOK_EVENTS: "ready_to_sync_outlook_events",
  SYNCING_OUTLOOK_EVENTS: "syncing_outlook_events",
  DONE_TO_SYNC_OUTLOOK_EVENTS: "done_to_sync_outlook_events",
  FAILED_TO_SYNC_OUTLOOK_EVENTS: "failed_to_sync_outlook_events",

  READY_TO_SYNC_UPDATED_EVENTS: "ready_to_sync_updated_events",
  SYNCING_UPDATED_EVENTS: "syncing_updated_events",
  DONE_TO_SYNC_UPDATED_EVENTS: "done_to_sync_updated_events",
  FAILED_TO_SYNC_UPDATED_EVENTS: "failed_to_sync_updated_events",

  READY_TO_SYNC_UPDATED_ISSUE_EVENTS: "ready_to_sync_updated_issue_events",
  SYNCING_UPDATED_ISSUE_EVENTS: "syncing_updated_issue_events",
  DONE_TO_SYNC_UPDATED_ISSUE_EVENTS: "done_to_sync_updated_issue_events",
  FAILED_TO_SYNC_UPDATED_ISSUE_EVENTS: "failed_to_sync_updated_issue_events",

  READY_TO_DELETE_OUTLOOK_EVENTS: "ready_to_delete_outlook_events",
  DELETING_OUTLOOK_EVENTS: "deleting_outlook_events",
  DONE_TO_DELETE_OUTLOOK_EVENTS: "done_to_delete_outlook_events",
  FAILED_TO_DELETE_OUTLOOK_EVENTS: "failed_to_delete_outlook_events",

  READY_TO_DELETE_OUTLOOK_ISSUE_EVENTS: "ready_to_delete_outlook_issue_events",
  DELETING_OUTLOOK_ISSUE_EVENTS: "deleting_outlook_issue_events",
  DONE_TO_DELETE_OUTLOOK_ISSUE_EVENTS: "done_to_delete_outlook_issue_events",
  FAILED_TO_DELETE_OUTLOOK_ISSUE_EVENTS: "failed_to_delete_outlook_issue_events",

  READY_TO_DELETE_EVENTS: "ready_to_delete_events",
  DELETING_EVENTS: "deleting_events",
  DONE_TO_DELETE_EVENTS: "done_to_delete_events",
  FAILED_TO_DELETE_EVENTS: "failed_to_delete_events",

  READY_TO_DELETE_HIDDEN_ISSUE_EVENTS: "ready_to_delete_hidden_issue_events",
  DELETING_HIDDEN_ISSUE_EVENTS: "deleting_hidden_issue_events",
  DONE_TO_DELETE_HIDDEN_ISSUE_EVENTS: "done_to_delete_hidden_issue_events",
  FAILED_TO_DELETE_HIDDEN_ISSUE_EVENTS: "failed_to_delete_hidden_issue_events",

  READY_TO_SYNC_NEW_EVENTS: "ready_to_sync_new_events",
  SYNCING_NEW_EVENTS: "syncing_new_events",
  DONE_TO_SYNC_NEW_EVENTS: "done_to_sync_new_events",
  FAILED_TO_SYNC_NEW_EVENTS: "failed_to_sync_new_events",

  READY_TO_SYNC_NEW_ISSUE_EVENTS: "ready_to_sync_new_issue_events",
  SYNCING_NEW_ISSUE_EVENTS: "syncing_new_issue_events",
  DONE_TO_SYNC_NEW_ISSUE_EVENTS: "done_to_sync_new_issue_events",
  FAILED_TO_SYNC_NEW_ISSUE_EVENTS: "failed_to_sync_new_issue_events",

  READY_TO_SYNC_UPDATED_SERIES_EVENTS: "ready_to_sync_updated_series_events",
  SYNCING_UPDATED_SERIES_EVENTS: "syncing_updated_series_events",
  DONE_TO_SYNC_UPDATED_SERIES_EVENTS: "done_to_sync_updated_series_events",
  FAILED_TO_SYNC_UPDATED_SERIES_EVENTS: "failed_to_sync_updated_series_events",

  READY_TO_SYNC_EVENT_CATEGORIES: "ready_to_sync_event_categories",
  SYNCING_EVENT_CATEGORIES: "syncing_event_categories",
  DONE_TO_SYNC_EVENT_CATEGORIES: "done_to_sync_event_categories",
  FAILED_TO_SYNC_EVENT_CATEGORIES: "failed_to_sync_event_categories",

  READY_TO_FINISH_SYNC_UPDATE: "ready_to_finish_sync_update",
  FINISHING_SYNC_UPDATE: "finishing_sync_update",
  FAILED_TO_FINISH_SYNC_UPDATE: "failed_to_finish_sync_update",

  // other process

  DISABLING: "disabling",
  DISABLED: "disabled",
  FAILED_TO_DISABLE: "failed_to_disable",

  AUTHORIZING: "authorizing",
  FAILED_TO_AUTHORIZE: "failed_to_authorize",

  DISCONNECTING: "disconnecting",
  DISCONNECTED: "disconnected",
  FAILED_TO_DISCONNECT: "failed_to_disconnect",

}




const OutlookCalendarSyncStatusArray = Object.keys(
  OutlookCalendarSyncStatus
).map((k) => OutlookCalendarSyncStatus[k]);


const getOutlookSyncStatusTypesWithKey = (key) => {
  const types = {};
  for (const status of OutlookCalendarSyncStatusArray) {
    types[String(status).toUpperCase()] = (key ? key + "_" : "") + status;
  }
  return types;
};



const isIjLocal = process.env.IJ_LOCAL === 'true';
const isDevIj = process.env.IJ_DEV === 'true';
// const isLocal = false;
// const isDev = false;

// this is for production
let OutlookCalendarSyncStatusObj = OutlookCalendarSyncStatus;

// for ij local
if (isIjLocal)
  OutlookCalendarSyncStatusObj = getOutlookSyncStatusTypesWithKey("ij_local");
if (isDevIj)
  OutlookCalendarSyncStatusObj = getOutlookSyncStatusTypesWithKey("ij_dev");
//   OutlookCalendarSyncStatusObj = getOutlookSyncStatusTypesWithKey("local");
// else if (isDev)
//   OutlookCalendarSyncStatusObj = getOutlookSyncStatusTypesWithKey("dev");

const getOutlookSyncStatusTypesArrayWithKey = () => {
  return Object
    .keys(OutlookCalendarSyncStatusObj)
    .map((k) => OutlookCalendarSyncStatusObj[k]);
};
// console.log({ OutlookCalendarSyncStatusObj, arr: getOutlookSyncStatusTypesArrayWithKey() })

const FailedOutlookCalendarSyncStatus = [
  OutlookCalendarSyncStatusObj.FAILED_TO_PREP_INIT,
  OutlookCalendarSyncStatusObj.FAILED_INITIALIZING,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_FETCH_NEW_OUTLOOK_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_FINISH_FIRST_SYNC,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_DELETED_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_OUTLOOK_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_UPDATED_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_UPDATED_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_DELETE_OUTLOOK_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_DELETE_OUTLOOK_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_DELETE_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_DELETE_HIDDEN_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_NEW_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_NEW_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_UPDATED_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_EVENT_CATEGORIES,
  OutlookCalendarSyncStatusObj.FAILED_TO_FINISH_SYNC_UPDATE,
  OutlookCalendarSyncStatusObj.FAILED_TO_DISABLE,
  OutlookCalendarSyncStatusObj.FAILED_TO_AUTHORIZE,
  OutlookCalendarSyncStatusObj.FAILED_TO_DISCONNECT,
]

const BusyOutlookCalendarSyncStatus = [
  OutlookCalendarSyncStatusObj.PREPPING_INIT,
  OutlookCalendarSyncStatusObj.INITIALIZING,
  OutlookCalendarSyncStatusObj.SYNCING_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.FETCHING_NEW_OUTLOOK_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_NEW_OUTLOOK_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.FINISHING_FIRST_SYNC,
  OutlookCalendarSyncStatusObj.SYNCING_DELETED_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_OUTLOOK_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_UPDATED_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_UPDATED_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.DELETING_OUTLOOK_EVENTS,
  OutlookCalendarSyncStatusObj.DELETING_OUTLOOK_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.DELETING_EVENTS,
  OutlookCalendarSyncStatusObj.DELETING_HIDDEN_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_NEW_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_NEW_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_UPDATED_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_EVENT_CATEGORIES,
  OutlookCalendarSyncStatusObj.FINISHING_SYNC_UPDATE,
  OutlookCalendarSyncStatusObj.DISABLING,
  OutlookCalendarSyncStatusObj.AUTHORIZING,
  OutlookCalendarSyncStatusObj.DISCONNECTING,
]

const PendingOutlookCalendarSyncStatus = [
  OutlookCalendarSyncStatusObj.READY_TO_PREP_INIT,
  OutlookCalendarSyncStatusObj.READY_TO_INITIALIZE,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_FETCH_NEW_OUTLOOK_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_FINISH_FIRST_SYNC,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_DELETED_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_OUTLOOK_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_UPDATED_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_UPDATED_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_DELETE_OUTLOOK_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_DELETE_OUTLOOK_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_DELETE_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_DELETE_HIDDEN_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_NEW_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_NEW_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_UPDATED_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_EVENT_CATEGORIES,
  OutlookCalendarSyncStatusObj.READY_TO_FINISH_SYNC_UPDATE,
]

const SyncingOutlookCalendarSyncStatus = [
  OutlookCalendarSyncStatusObj.DONE_TO_INITIALIZE,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.DONE_TO_SYNC_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_EVENTS,
  OutlookCalendarSyncStatusObj.DONE_TO_SYNC_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.DONE_TO_SYNC_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_FETCH_NEW_OUTLOOK_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.FETCHING_NEW_OUTLOOK_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.DONE_TO_FETCH_NEW_OUTLOOK_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_FETCH_NEW_OUTLOOK_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_NEW_OUTLOOK_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.DONE_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_FINISH_FIRST_SYNC,
  OutlookCalendarSyncStatusObj.FINISHING_FIRST_SYNC,
  OutlookCalendarSyncStatusObj.FAILED_TO_FINISH_FIRST_SYNC,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_DELETED_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_DELETED_EVENTS,
  OutlookCalendarSyncStatusObj.DONE_TO_SYNC_DELETED_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_DELETED_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_OUTLOOK_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_OUTLOOK_EVENTS,
  OutlookCalendarSyncStatusObj.DONE_TO_SYNC_OUTLOOK_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_OUTLOOK_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_UPDATED_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_UPDATED_EVENTS,
  OutlookCalendarSyncStatusObj.DONE_TO_SYNC_UPDATED_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_UPDATED_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_UPDATED_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_UPDATED_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.DONE_TO_SYNC_UPDATED_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_UPDATED_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_DELETE_OUTLOOK_EVENTS,
  OutlookCalendarSyncStatusObj.DELETING_OUTLOOK_EVENTS,
  OutlookCalendarSyncStatusObj.DONE_TO_DELETE_OUTLOOK_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_DELETE_OUTLOOK_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_DELETE_OUTLOOK_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.DELETING_OUTLOOK_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.DONE_TO_DELETE_OUTLOOK_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_DELETE_OUTLOOK_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_DELETE_EVENTS,
  OutlookCalendarSyncStatusObj.DELETING_EVENTS,
  OutlookCalendarSyncStatusObj.DONE_TO_DELETE_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_DELETE_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_DELETE_HIDDEN_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.DELETING_HIDDEN_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.DONE_TO_DELETE_HIDDEN_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_DELETE_HIDDEN_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_NEW_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_NEW_EVENTS,
  OutlookCalendarSyncStatusObj.DONE_TO_SYNC_NEW_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_NEW_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_NEW_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_NEW_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.DONE_TO_SYNC_NEW_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_NEW_ISSUE_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_UPDATED_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.SYNCING_UPDATED_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.DONE_TO_SYNC_UPDATED_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_UPDATED_SERIES_EVENTS,
  OutlookCalendarSyncStatusObj.READY_TO_SYNC_EVENT_CATEGORIES,
  OutlookCalendarSyncStatusObj.SYNCING_EVENT_CATEGORIES,
  OutlookCalendarSyncStatusObj.DONE_TO_SYNC_EVENT_CATEGORIES,
  OutlookCalendarSyncStatusObj.FAILED_TO_SYNC_EVENT_CATEGORIES,
  OutlookCalendarSyncStatusObj.READY_TO_FINISH_SYNC_UPDATE,
  OutlookCalendarSyncStatusObj.FINISHING_SYNC_UPDATE,
  OutlookCalendarSyncStatusObj.FAILED_TO_FINISH_SYNC_UPDATE,
]

const InitializingOutlookCalendarSyncStatus = [
  OutlookCalendarSyncStatusObj.READY_TO_PREP_INIT,
  OutlookCalendarSyncStatusObj.PREPPING_INIT,
  OutlookCalendarSyncStatusObj.DONE_TO_PREP_INIT,
  OutlookCalendarSyncStatusObj.FAILED_TO_PREP_INIT,
  OutlookCalendarSyncStatusObj.READY_TO_INITIALIZE,
  OutlookCalendarSyncStatusObj.INITIALIZING,
  OutlookCalendarSyncStatusObj.FAILED_INITIALIZING,
]

const CalendarSyncLimit = {
  OCCURRENCE_EVENT_LIMIT: 100,
  ISSUE_EVENT_LIMIT: 120,
  SERIES_EVENT_LIMIT: 120,
  EVENT_LIMIT: 120,
  SAVE_ISSUE_EVENT_LIMIT: 60,
  SAVE_EVENT_LIMIT: 60,
  UPDATE_ISSUE_EVENT_LIMIT: 100,
  UPDATE_SERIES_EVENT_LIMIT: 100,
  UPDATE_EVENT_LIMIT: 100,
}

module.exports = {
  OutlookCalendarSyncStatus: OutlookCalendarSyncStatusObj,
  FailedOutlookCalendarSyncStatus,
  BusyOutlookCalendarSyncStatus,
  PendingOutlookCalendarSyncStatus,
  InitializingOutlookCalendarSyncStatus,
  SyncingOutlookCalendarSyncStatus,
  OutlookCalendarSyncStatusArray: getOutlookSyncStatusTypesArrayWithKey(),
  CalendarSyncLimit
}
