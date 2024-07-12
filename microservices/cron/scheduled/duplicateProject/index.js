const cron = require('node-cron');
const { loggerInfo } = require('../../config/logger');
const { runDuplicateProjectJobsComments } = require('./comments');
const { runDuplicateProjectJobsInitCustomFields } = require('./customFieldsIds');
const { runDuplicateProjectJobsCustomFields } = require('./cutomFields');
const { runDuplicateProjectJobsEvents } = require('./events');
const { runDuplicateProjectJobsIssues } = require('./issues');
const { runUpdateDuplicateProjectJobsStatus } = require('./jobStatus');
const { runDuplicateProjectJobsPrefixes } = require('./prefixes');
const { runDuplicateProjectJobsSeriesMasterEvents } = require('./seriesMasterEvents');


const runDuplicateProjectJobs = () => {
  

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runUpdateDuplicateProjectJobsStatus every 5 secs', new Date())
    runUpdateDuplicateProjectJobsStatus();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runDuplicateProjectJobsInitCustomFields every 5 secs', new Date())
    runDuplicateProjectJobsInitCustomFields();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runDuplicateProjectJobsCustomFields every 5 secs', new Date())
    runDuplicateProjectJobsCustomFields();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runDuplicateProjectJobsPrefixes every 5 secs', new Date())
    runDuplicateProjectJobsPrefixes();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runDuplicateProjectJobsSeriesMasterEvents every 5 secs', new Date())
    runDuplicateProjectJobsSeriesMasterEvents();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runDuplicateProjectJobsEvents every 5 secs', new Date())
    runDuplicateProjectJobsEvents();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runDuplicateProjectJobsIssues every 5 secs', new Date())
    runDuplicateProjectJobsIssues();
  });

  cron.schedule('*/5 * * * * *', () => {
    loggerInfo('runDuplicateProjectJobsComments every 5 secs', new Date())
    runDuplicateProjectJobsComments();
  });

}

module.exports = {
  runDuplicateProjectJobs
}
