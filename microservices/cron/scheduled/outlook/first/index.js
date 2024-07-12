const cron = require('node-cron');
const { loggerInfo } = require('../../../config/logger');

const { runSyncEventsOutlookJobs } = require("./sync-events");
const { runSyncFinishOutlookFirstSyncJobs } = require("./sync-finish");
const { runSyncIssueEventsOutlookJobs } = require("./sync-issue-events");
const { runSyncSeriesEventsOutlookJobs } = require("./sync-series-events");
const { runUpdateFirstOutlookSyncStatusJobs } = require("./sync-status-update");


const runFirstOutlookSyncCronSchedules = () => {

  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runSyncIssueEventsOutlookJobs every 5 sec', new Date())
    runSyncIssueEventsOutlookJobs();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runSyncEventsOutlookJobs every 5 sec', new Date())
    runSyncEventsOutlookJobs();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runSyncSeriesEventsOutlookJobs every 5 sec', new Date())
    runSyncSeriesEventsOutlookJobs();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runSyncFinishOutlookFirstSyncJobs every 5 sec', new Date())
    runSyncFinishOutlookFirstSyncJobs();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runUpdateFirstOutlookSyncStatusJobs every 5 sec', new Date())
    runUpdateFirstOutlookSyncStatusJobs();
  });

}


module.exports = {
  runFirstOutlookSyncCronSchedules
}
