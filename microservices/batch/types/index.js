const { gql } = require('apollo-server');
const { mergeTypes } = require('merge-graphql-schemas');
const Mail = require("./mail");
const Outlook = require("./outlook");
const OutlookCalendar = require("./outlook-calendar");
const SoapService = require("./soapService");
const lexOfficeIntegration = require("./lexOfficeIntegration");

const typeDefs = gql`${mergeTypes(
  [
    Mail,
    Outlook,
    OutlookCalendar,
    SoapService,
    lexOfficeIntegration
  ]
)}`;

module.exports = typeDefs;
