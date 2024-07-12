
const cron = require('node-cron');
const { loggerInfo } = require("../../../config/logger");

const { runSyncFetchNewOutlookSeriesEventsOutlookJobs } = require('./sync-fetch-new-outlook-series-events');
const { runSyncNewOutlookSeriesEventsOutlookJobs } = require('./sync-new-outlook-series-events');
const { runResetAllOutlookSyncJobs } = require('./reset-all-sync')
const { runSyncPrepInitOutlookJobs } = require('./sync-prep')

const runCommonOutlookSyncCronSchedules = () => {

  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runSyncFetchNewOutlookSeriesEventsOutlookJobs every 3 sec', new Date())
    runSyncFetchNewOutlookSeriesEventsOutlookJobs();
  });

  cron.schedule('*/3 * * * * *', () => {
    loggerInfo('runSyncNewOutlookSeriesEventsOutlookJobs every 3 sec', new Date())
    runSyncNewOutlookSeriesEventsOutlookJobs();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runSyncPrepInitOutlookJobs every 5 sec', new Date())
    runSyncPrepInitOutlookJobs();
  });
  

}


module.exports = {
  runCommonOutlookSyncCronSchedules,
  runResetAllOutlookSyncJobs
}
