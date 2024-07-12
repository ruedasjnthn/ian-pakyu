const cron = require('node-cron');

const { runSyncOutlookEventsOutlookJobs } = require("./sync-outlook-events");
const { runSyncDeleteSyncedEventsOutlookJobs } = require("./sync-delete-events");
const { runSyncDeleteSyncedHiddenIssueEventsOutlookJobs } = require("./sync-delete-hidden-issue-events");
const { runSyncDeleteSyncedOutlookEventsOutlookJobs } = require("./sync-delete-outlook-events");
const { runSyncDeleteSyncedOutlookIssueEventsOutlookJobs } = require("./sync-delete-outlook-issue-events");
const { runSyncEventsCategoriesOutlookJobs } = require("./sync-event-categories");
const { runSyncDeletedEventsOutlookJobs } = require("./sync-deleted-events");
const { runSyncFinishOutlookUpdateSyncJobs } = require("./sync-finish");
const { runSyncNewEventsOutlookJobs } = require("./sync-new-events");
const { runSyncNewIssueEventsOutlookJobs } = require("./sync-new-issue-events");
const { runUpdateOutlookSyncStatusJobs } = require("./sync-status-update");
const { runSyncUpdatedEventsOutlookJobs } = require("./sync-updated-events");
const { runSyncUpdateIssueEventsOutlookJobs } = require("./sync-updated-issue-events");
const { runSyncUpdateSeriesEventsOutlookJobs } = require("./sync-updated-series-events");
const { loggerInfo } = require('../../../config/logger');

const runUpdateOutlookSyncCronSchedules = () => {

  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runSyncDeleteSyncedEventsOutlookJobs every 5 sec', new Date())
    runSyncDeleteSyncedEventsOutlookJobs();
  });
  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runSyncIssueEventsOutlookJobs runSyncDeleteSyncedHiddenIssueEventsOutlookJobs 5 sec', new Date())
    runSyncDeleteSyncedHiddenIssueEventsOutlookJobs();
  });
  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runSyncIssueEventsOutlookJobs runSyncDeleteSyncedOutlookEventsOutlookJobs 5 sec', new Date())
    runSyncDeleteSyncedOutlookEventsOutlookJobs();
  });
  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runSyncIssueEventsOutlookJobs every runSyncDeleteSyncedOutlookIssueEventsOutlookJobs sec', new Date())
    runSyncDeleteSyncedOutlookIssueEventsOutlookJobs();
  });
  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runSyncEventsCategoriesOutlookJobs every 5 sec', new Date())
    runSyncEventsCategoriesOutlookJobs();
  });
  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runSyncDeletedEventsOutlookJobs every 5 sec', new Date())
    runSyncDeletedEventsOutlookJobs();
  });
  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runSyncFinishOutlookUpdateSyncJobs every 5 sec', new Date())
    runSyncFinishOutlookUpdateSyncJobs();
  });
  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runSyncNewEventsOutlookJobs every 5 sec', new Date())
    runSyncNewEventsOutlookJobs();
  });
  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runSyncNewIssueEventsOutlookJobs every 5 sec', new Date())
    runSyncNewIssueEventsOutlookJobs();
  });
  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runSyncOutlookEventsOutlookJobs every 5 sec', new Date())
    runSyncOutlookEventsOutlookJobs();
  });
  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runUpdateOutlookSyncStatusJobs every 5 sec', new Date())
    runUpdateOutlookSyncStatusJobs();
  });
  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runSyncUpdatedEventsOutlookJobs every 5 sec', new Date())
    runSyncUpdatedEventsOutlookJobs();
  });
  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runSyncUpdateIssueEventsOutlookJobs every 5 sec', new Date())
    runSyncUpdateIssueEventsOutlookJobs();
  });
  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runSyncUpdateSeriesEventsOutlookJobs every 5 sec', new Date())
    runSyncUpdateSeriesEventsOutlookJobs();
  });


}


module.exports = {
  runUpdateOutlookSyncCronSchedules
}