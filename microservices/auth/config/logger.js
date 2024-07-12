require("dotenv").config();
const graylog2 = require("graylog2");

const GREYLOG_HOST = process.env.GREYLOG_HOST
const GREYLOG_PORT = process.env.GREYLOG_PORT

const logger = new graylog2.graylog({
  servers: [
    {
      host: GREYLOG_HOST,
      port: GREYLOG_PORT
    },
  ],
});

logger.on('error', function (error) {
  console.error('Error while trying to write to graylog2:', error);
});

const LOG_IN_GREYLOG = process.env.LOG_IN_GREYLOG === 'true'
const LOG_IN_CONSOLE = process.env.LOG_IN_CONSOLE === 'true'
const LOCAL_DEV = process.env.LOCAL_DEV === 'true'

const loggerLog = (...args) => {
  if (LOG_IN_GREYLOG) logger.log(...args)
  if (LOG_IN_CONSOLE) console.log(...args)
}

const loggerAlert = (...args) => {
  if (LOG_IN_GREYLOG) logger.alert(...args)
  if (LOG_IN_CONSOLE) console.log('Alert', ...args)
}

const loggerError = (...args) => {
  if (LOG_IN_GREYLOG) logger.error(...args)
  if (LOG_IN_CONSOLE) console.log('ERROR! ', ...args)
}

const loggerEmergency = (...args) => {
  if (LOG_IN_GREYLOG) logger.emergency(...args)
  if (LOG_IN_CONSOLE) console.log('EMERGENCY! ', ...args)
}

const loggerCritical = (...args) => {
  if (LOG_IN_GREYLOG) logger.critical(...args)
  if (LOG_IN_CONSOLE) console.log('CRITICAL! ', ...args)
}

const loggerWarning = (...args) => {
  if (LOG_IN_GREYLOG) logger.warning(...args)
  if (LOG_IN_CONSOLE) console.log('WARNING! ', ...args)
}

const loggerNotice = (...args) => {
  if (LOG_IN_GREYLOG) logger.notice(...args)
  if (LOG_IN_CONSOLE) console.log('NOTICE! ', ...args)
}

const loggerInfo = (...args) => {
  if (LOG_IN_GREYLOG) logger.info(...args)
  if (LOG_IN_CONSOLE) console.log('INFO! ', ...args)
}

const loggerDebug = (...args) => {
  if (LOG_IN_GREYLOG) logger.debug(...args)
  if (LOG_IN_CONSOLE) console.log('DEBUG! ', ...args)
}

const loggerLocal = (...args) => {
  if (LOCAL_DEV) console.log(...args)
}

module.exports = {
  logger,
  loggerLog,
  loggerAlert,
  loggerError,
  loggerEmergency,
  loggerCritical,
  loggerWarning,
  loggerNotice,
  loggerInfo,
  loggerDebug,
  loggerLocal
}
