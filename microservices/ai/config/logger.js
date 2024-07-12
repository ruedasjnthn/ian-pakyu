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

const loggerLog = (...args) => {
  if (LOG_IN_GREYLOG) logger.log(...args)
  if (LOG_IN_CONSOLE) console.log(...args)
}

const loggerAlert = (...args) => {
  if (LOG_IN_GREYLOG) logger.alert('Alert', ...args)
  if (LOG_IN_CONSOLE) console.log('Alert', ...args)
}

const loggerError = (...args) => {
  if (LOG_IN_GREYLOG) logger.error('ERROR! ', ...args)
  if (LOG_IN_CONSOLE) console.log('ERROR! ', ...args)
}

const loggerEmergency = (...args) => {
  if (LOG_IN_GREYLOG) logger.emergency('EMERGENCY! ', ...args)
  if (LOG_IN_CONSOLE) console.log('EMERGENCY! ', ...args)
}

const loggerCritical = (...args) => {
  if (LOG_IN_GREYLOG) logger.critical('CRITICAL! ', ...args)
  if (LOG_IN_CONSOLE) console.log('CRITICAL! ', ...args)
}

const loggerWarning = (...args) => {
  if (LOG_IN_GREYLOG) logger.warning('WARNING! ', ...args)
  if (LOG_IN_CONSOLE) console.log('WARNING! ', ...args)
}

const loggerNotice = (...args) => {
  if (LOG_IN_GREYLOG) logger.notice('NOTICE! ', ...args)
  if (LOG_IN_CONSOLE) console.log('NOTICE! ', ...args)
}

const loggerInfo = (...args) => {
  if (LOG_IN_GREYLOG) logger.info('INFO! ', ...args)
  if (LOG_IN_CONSOLE) console.log('INFO! ', ...args)
}

const loggerDebug = (...args) => {
  if (LOG_IN_GREYLOG) logger.debug('DEBUG! ', ...args)
  if (LOG_IN_CONSOLE) console.log('DEBUG! ', ...args)
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
}
