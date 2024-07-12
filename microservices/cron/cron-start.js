require("dotenv").config();
const cron = require('node-cron');

const { runAutomationJobs } = require("./scheduled/automation");
const runAsyncBackup = require("./backup");
const asyncRunRestoreProject = require('./scheduled/restore-project');
const connectDb = require('./config/db');
const { saveTotalSizePerProject } = require('./scheduled/project');
const runTriggerBackup = require("./triggeredBackup");
const deleteOlderBackup = require("./deleteOlderBackup");
const renewSubscriptionExpirationDate = require("./autoRenewSubscription");
const { ProceessPendingOCRFiles } = require("./pdfOCRGeneration");
const { ProceessSoapServices } = require("./soapServiceProcessor");
const { loggerInfo, loggerError } = require('./config/logger');
const { runMailJobs } = require("./outlook/mail");
const { resetAllContactSyncs } = require("./scheduled/contacts/reset-all-sync");
const { runReadyToInitializeContact } = require("./scheduled/contacts/init");
const { runReadyToSyncContact } = require("./scheduled/contacts/sync");
const { runSyncAllContacts } = require("./scheduled/contacts/update-sync-status");
const { lexOfficeIntegrationProcessor } = require("./lexOfficeIntegrationProcessor");
const { runFirstOutlookSyncCronSchedules } = require("./scheduled/outlook/first");
const { runUpdateOutlookSyncCronSchedules } = require("./scheduled/outlook/update");
const { runResetAllOutlookSyncJobs, runCommonOutlookSyncCronSchedules } = require("./scheduled/outlook/common");
const { runInitOutlookSyncCronSchedules } = require("./scheduled/outlook/init");
const { runDuplicateProjectJobs } = require("./scheduled/duplicateProject");
const { runExportProjectJobs } = require("./scheduled/exportProject");
const { CopyDataToCustomBlobStorage, RemoveMigratedFiles } = require("./blobStorageMigration");

connectDb()

runResetAllOutlookSyncJobs()

runInitOutlookSyncCronSchedules()
runFirstOutlookSyncCronSchedules()
runUpdateOutlookSyncCronSchedules()
runCommonOutlookSyncCronSchedules()

// duplicate project jobs
runDuplicateProjectJobs()

runExportProjectJobs()

resetAllContactSyncs()

cron.schedule('0 0 * * *', function () {
  loggerInfo('runBackup every midnight', new Date(), Date.now())
  runAsyncBackup();
});

cron.schedule('*/5 * * * *', function () {
  loggerInfo('runTriggerBackup every 5 minutes', new Date(), Date.now())
  runTriggerBackup();
});

cron.schedule('0 23 * * *', function () {
  loggerInfo('deleteOlderBackup every 11 pm', new Date(), Date.now())
  deleteOlderBackup();
});

cron.schedule('* * * * *', function () {
  loggerInfo('runRestoreProject every minute', new Date(), Date.now())
  asyncRunRestoreProject();
});

cron.schedule('*/5 * * * * *', () => {
  loggerInfo('runAutomationJobs every 1 min', new Date())
  runAutomationJobs();
});

cron.schedule('0 1 * * *', function () {
  loggerInfo('saveTotalSizePerProject every 1 am', new Date())
  saveTotalSizePerProject();
});

cron.schedule('*/5 * * * * *', () => {
  console.log('-----------------------------------')
  loggerInfo('runReadyToInitializeContact every 5 secs', new Date())
  runReadyToInitializeContact();
  console.log('-----------------------------------')
});

cron.schedule('*/5 * * * * *', () => {
  console.log('-----------------------------------')
  loggerInfo('runReadyToSyncContact every 5 secs', new Date())
  runReadyToSyncContact();
  console.log('-----------------------------------')
});

cron.schedule('*/1 * * * *', () => {
  console.log('-----------------------------------')
  loggerInfo('runSyncAllContacts every 5 mins', new Date())
  runSyncAllContacts();
  console.log('-----------------------------------')

});

cron.schedule('0 23 * * *', function () {
  loggerInfo('renewSubscriptionExpirationDate every 11 pm', new Date())
  renewSubscriptionExpirationDate();
});

cron.schedule('* * * * *', function () {
  loggerInfo('runMailJobs every minute', new Date())
  runMailJobs();
});

let isOcrGenRunning = false
cron.schedule('* * * * *', async () => {
  loggerInfo('Generate OCRs every 1 min', new Date());
  try {
    if (!isOcrGenRunning) {
      isOcrGenRunning = true;
      let _ = await ProceessPendingOCRFiles();
      isOcrGenRunning = false;
    }
  } catch (error) {
    loggerError({ error })
    isOcrGenRunning = false;
  }
});

let isSoapServiceProcessorRunning = false;
cron.schedule('*/5 * * * *', async () => {
  loggerInfo('ProceessSoapServices every 5 min', new Date());
  try {
    if (!isSoapServiceProcessorRunning) {
      isSoapServiceProcessorRunning = true;
      let _ = await ProceessSoapServices();
      isSoapServiceProcessorRunning = false;
    }
  } catch (error) {
    loggerError({ error })
    isSoapServiceProcessorRunning = false;
  }
});

let islexOfficeIntegrationProcessorRunning = false;
cron.schedule('*/5 * * * *', async () => {
  loggerInfo('lexOfficeIntegrationProcessorRunning every 5 min', new Date());
  try {
    if (!islexOfficeIntegrationProcessorRunning) {
      islexOfficeIntegrationProcessorRunning = true;
      let _ = await lexOfficeIntegrationProcessor();
      islexOfficeIntegrationProcessorRunning = false;
    }
  } catch (error) {
    loggerError({ error })
    islexOfficeIntegrationProcessorRunning = false;
  }
});



let blobStorageMigration = false;
cron.schedule('*/5 * * * *', async () => {
  loggerInfo('blobStorageMigration every 5 min', new Date());
  try {
    if (!blobStorageMigration) {
      blobStorageMigration = true;
      let _ = await CopyDataToCustomBlobStorage();
     //let __ = await RemoveMigratedFiles();
      blobStorageMigration = false;
    }
  } catch (error) {
    loggerError({ error })
    blobStorageMigration = false;
  }
});



