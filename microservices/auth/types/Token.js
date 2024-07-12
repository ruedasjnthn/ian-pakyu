const { gql } = require('apollo-server');

module.exports = gql`
  input DocumentInput {
    fileType: String!
    key: String!
    title: String!
    url: String!
  }

  input EditorConfigInput {
    callbackUrl: String!
  }

  input ParamsInput {
    document: DocumentInput!
    editorConfig: EditorConfigInput!
  }

  type TokenResponse {
    token: String
    key: String
  }

  type Query {
    generateToken(params: ParamsInput!): TokenResponse!
  }
`;
