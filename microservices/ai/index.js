const { ApolloServer, gql } = require("apollo-server");
const { buildSubgraphSchema } = require("@apollo/federation");
const connectDb = require("./config/db");
const typeDefs = require("./types");
const resolvers = require("./resolvers");
const models = require("./models");
const { applyMiddleware } = require("graphql-middleware");
const { permissions } = require("./permissions");
const { loggerInfo, loggerError } = require('./config/logger')

connectDb();

const server = new ApolloServer({
  schema: applyMiddleware(
    buildSubgraphSchema([{ typeDefs, resolvers }]),
    permissions
  ),
  context: ({ req }) => {
    const user = req.headers.user ? JSON.parse(req.headers.user) : null;
    return { models, user };
  }
});


server.listen({ port: 4006 }).then(({ url }) => {
  loggerInfo(`🚀 Server ready at ${url}`);
});
