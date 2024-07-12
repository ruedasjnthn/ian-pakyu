const { gql } = require('apollo-server');

module.exports = gql`
type Action {
  name: String
  subline: String
}
type SubMenuItem {
  title: String!
  icon: String!
  gptRequest: String!
  action: Action!
}

type AiMenuItem {
  title: String!
  icon: String!
  gptRequest: String
  action: Action
  subMenuItems: [SubMenuItem!]
}
type Query {
  aiMenuItems: [AiMenuItem]
}
type Mutation {
  aiResponse(input: String!): String
}
`;
