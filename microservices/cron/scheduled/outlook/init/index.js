const { runSyncInitializeOutlookJobs } = require("./sync-init");
const { runUpdateInitOutlookSyncStatusJobs } = require("./init-update-status");

const cron = require('node-cron');
const { loggerInfo } = require("../../../config/logger");

const runInitOutlookSyncCronSchedules = () => {

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runUpdateInitOutlookSyncStatusJobs every 5 sec', new Date())
    runUpdateInitOutlookSyncStatusJobs();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runSyncInitializeOutlookJobs every 5 sec', new Date())
    runSyncInitializeOutlookJobs();
  });

}

module.exports = {
  runInitOutlookSyncCronSchedules,
}
