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

const ContactIdIssueIdMappingSchema = new Schema({
  issueId: {
    type: String,
    required: true
  },
  contactId: {
    type: String,
    required: true
  },
  version: {
    type: Number,
    required: true
  },
  lastSyncDate: {
    type: Date
  },

})

const lexOfficeIntegrationSchema = new Schema({
  userId: {
    type: mongoose.Types.ObjectId,
  },
  projectId: {
    type: String,
  },
  apiKey: {
    type: String,
  },
  fieldMapping: {
    type: [mappingSchema],
  },
  isEnabled: {
    type: Boolean,
  },
  name:{
    type:String
  },
  ContactIdIssueIdMapping: [ContactIdIssueIdMappingSchema],
  
  lastSyncDate: {
    type: Date
  }
});

const lexOfficeIntegration = mongoose.model(
  'lexOfficeIntegration',
  lexOfficeIntegrationSchema,
  'col_lexOfficeIntegration',
);

module.exports = { lexOfficeIntegration };
