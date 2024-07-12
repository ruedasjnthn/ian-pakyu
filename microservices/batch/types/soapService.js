const { gql } = require('apollo-server');

module.exports = gql`
input MappingInput{
  source: String
  destination: String
}

type SoapMapping{
  source: String
  destination: String
}

input CustomHeaderInput{
  headerValue: String
  headerName: String
}

type CustomHeader{
  headerValue: String
  headerName: String
}


input soapServiceInput{
    projectId:String
    userName:String
    password:String
    url:String
    soapAction:String
    inputParams:String
    fieldMapping:[MappingInput!]!
    contentType:String
    dataNode:String
    haveMultipleRecords:Boolean
    name:String
    soapServiceId:String
    decodingNode:String
    xmlMappingKeys:[String]
    isEnabled:Boolean,
    repeatForEveryIssue:Boolean,
    customHeaders:[CustomHeaderInput]!
    requestType:String
    serviceType:String
    incrementPageBy: String
    supportPaging:Boolean
    requirePreAuthorization:Boolean
    authorizatioURL:String
    authorizationRequestType:String
    authorizationBody:String
    authorizationTokenPath:String
    upsertIssueStatus:String

}

type soapService{
  id:String
  projectId:String
  userName:String
  url:String
  soapAction:String
  inputParams:String
  fieldMapping:[SoapMapping!]!
  contentType:String
  dataNode:String
  haveMultipleRecords:Boolean
  name:String
  password:String
  decodingNode:String
  xmlMappingKeys:[String]
  isEnabled:Boolean
  repeatForEveryIssue:Boolean
  customHeaders:[CustomHeader]!
  requestType:String
  serviceType:String
  supportPaging:Boolean
  incrementPageBy: String
  requirePreAuthorization:Boolean
  authorizatioURL:String
  authorizationRequestType:String
  authorizationBody:String
  authorizationTokenPath:String
  upsertIssueStatus:String
}

type UpsertIssueCustomField {
  label: String!
  value: String!
}
type UpsertIssuePropsResponse {
  customFields: [UpsertIssueCustomField]!
}

  type Mutation {
    saveSoapService(soapServiceInput: soapServiceInput!):String
    deleteSoapService(soapServiceId: String!):String
    getSoapServiceMappingFields(soapServiceInput: soapServiceInput!):[String]!
    getUpsertRequestFromSoapService(soapServiceId:String, issueId:String) : [UpsertIssuePropsResponse]
  }
  type Query {
    getSoapServices(projectId:String):[soapService!]
    getSoapService(soapServiceId:String):soapService
  }
`;

