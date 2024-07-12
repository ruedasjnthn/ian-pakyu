const { gql } = require('apollo-server');
const { mergeTypes } = require('merge-graphql-schemas');
const AiAssistant = require("./AiAssistant");

const typeDefs = gql`${mergeTypes([AiAssistant])}`;

module.exports = typeDefs;