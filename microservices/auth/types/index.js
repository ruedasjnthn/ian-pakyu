const { gql } = require('apollo-server');
const { mergeTypes } = require('merge-graphql-schemas');
const User = require("./User");
const DbHealth = require("./DbHealth")
const Token = require("./Token")

const typeDefs = gql`${mergeTypes([
  User,
  DbHealth,
  Token
])}`;

module.exports = typeDefs;