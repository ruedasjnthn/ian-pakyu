const calendarUpdateLogs = require("./calendarUpdateLogs");
const contacts = require('./contact');
const outlook = require("./outlook");
const contactSync = require('./contactSync');
const mail = require('./mail');
const mailRule = require('./mailRule');
const backup = require('./backup');
const soapService = require('./soapService');
const lexOfficeIntegration = require('./lexOfficeIntegration')

module.exports = {
  ...calendarUpdateLogs,
  ...contacts,
  ...outlook,
  ...contactSync,
  ...mail,
  ...mailRule,
  ...backup,
  ...soapService,
  ...lexOfficeIntegration
}