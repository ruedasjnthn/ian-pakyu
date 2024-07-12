const { gql } = require('apollo-server');

module.exports = gql`
input lexOfficeIntegrationMappingInput{
  source: String
  destination: String
}

type lexOfficeIntegrationMapping{
  source: String
  destination: String
}


input lexOfficeIntegrationInput{
    projectId:String
    fieldMapping:[lexOfficeIntegrationMappingInput!]!
    name:String
    lexOfficeIntegrationId:String
    isEnabled:Boolean,
    apiKey: String

}

type lexOfficeIntegration{
  id:String
  projectId:String
  name:String
  fieldMapping:[lexOfficeIntegrationMapping!]!
  isEnabled:Boolean,
  apiKey:String
}


  type Mutation {
    saveLexOfficeIntegration(lexOfficeIntegrationInput: lexOfficeIntegrationInput!):String
    deleteLexOfficeIntegration(lexOfficeIntegrationId: String!):String
  }
  type Query {
    getLexOfficeIntegrations(projectId:String):[lexOfficeIntegration!]
    getLexOfficeIntegration(lexOfficeIntegrationId:String):lexOfficeIntegration
  }
`;

