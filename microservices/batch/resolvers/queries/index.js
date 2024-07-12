const backup = require("./backup");
const outlook = require("./outlook");
const outlookTest = require("./outlook-test");
const mail = require('./mail');
const mailRule = require('./mailRule');
const soapService = require('./soapService')
const lexOfficeIntegration = require('./lexOfficeIntegration')

module.exports = {
  ...backup,
  ...outlook,
  ...outlookTest,
  ...mail,
  ...mailRule,
  ...soapService,
  ...lexOfficeIntegration
}
