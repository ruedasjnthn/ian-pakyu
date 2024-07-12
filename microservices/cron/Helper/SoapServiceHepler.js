const mongoose = require('mongoose');
const { Schema } = mongoose;

const mappingSchema = new Schema({
  source: {
    type: String,
    required: true
  },
  destination: {
    type: String,
    required: true
  },
})

const customHeadersSchema = new Schema({
  headerValue: {
    type: String,
    required: true
  },
  headerName: {
    type: String,
    required: true
  },
})

const soapServiceSchema = new Schema({
  userId: {
    type: mongoose.Types.ObjectId,
  },
  projectId: {
    type: String,
  },
  userName: {
    type: String,
  },
  password: {
    type: String,
  },
  url: {
    type: String,
  },
  soapAction: {
    type: String,
  },
  inputParams: {
    type: mongoose.Mixed,
  },
  fieldMapping: {
    type: [mappingSchema],
  },
  contentType: {
    type: String,
  }, 
  dataNode: {
    type: String,
  },
  decodingNode: {
    type: String,
  },
  haveMultipleRecords: {
    type: Boolean,
  },
  isEnabled: {
    type: Boolean,
  },
  name:{
    type:String
  },
  repeatForEveryIssue:{
    type: Boolean,
  },
  customHeaders: {
    type: [customHeadersSchema],
  },
  serviceType:{
    type:String
  },
  requestType:{
    type:String
  },
  lastSyncDate:{
    type: Date
  },
  supportPaging:{
    type:Boolean
  },
  requirePreAuthorization:{
    type:Boolean
  },
  incrementPageBy:{
    type:String
  },
  authorizatioURL:{
    type:String
  },
  authorizationRequestType:{
    type:String
  },
  authorizationBody:{
    type:String
  },
  authorizationTokenPath:{
    type:String
  },
  upsertIssueStatus: {
    type: String
  }

});

const SoapService = mongoose.model(
  'SoapService',
  soapServiceSchema,
  'col_SoapService',
);

module.exports = { SoapService };
