const cron = require('node-cron');
const { loggerInfo } = require('../../config/logger');
const { runExportProjectJobsComments } = require('./comments');
const { runExportProjectJobsInitCustomFieldsIds } = require('./customFieldsIds');
const { runExportProjectJobsCustomFields } = require('./cutomFields');
const { runExportProjectJobsEvents } = require('./events');
const { runFinishExportProjectJobs } = require('./finish');
const { runExportProjectJobsIssues } = require('./issues');
const { runUpdateExportProjectJobsStatus } = require('./jobStatus');
const { runExportProjectJobsPrefixes } = require('./prefixes');
const { runExportProjectJobsSeriesMasterEvents } = require('./seriesMasterEvents');



const runExportProjectJobs = () => {


  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runUpdateExportProjectJobsStatus every 5 secs', new Date())
    runUpdateExportProjectJobsStatus();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runDuplicateProjectJobsInitCustomFields every 5 secs', new Date())
    runExportProjectJobsInitCustomFieldsIds();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runDuplicateProjectJobsCustomFields every 5 secs', new Date())
    runExportProjectJobsCustomFields();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runDuplicateProjectJobsPrefixes every 5 secs', new Date())
    runExportProjectJobsPrefixes();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runDuplicateProjectJobsSeriesMasterEvents every 5 secs', new Date())
    runExportProjectJobsSeriesMasterEvents();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runDuplicateProjectJobsEvents every 5 secs', new Date())
    runExportProjectJobsEvents();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runDuplicateProjectJobsIssues every 5 secs', new Date())
    runExportProjectJobsIssues();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runDuplicateProjectJobsComments every 5 secs', new Date())
    runExportProjectJobsComments();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runFinishExportProjectJobs every 5 secs', new Date())
    runFinishExportProjectJobs();
  });

}

module.exports = {
  runExportProjectJobs
}
