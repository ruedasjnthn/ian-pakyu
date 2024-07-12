require("dotenv").config();
const { ApolloServer, gql } = require("apollo-server");
const { applyMiddleware } = require("graphql-middleware");
const { buildSubgraphSchema } = require("@apollo/federation");
const connectDb = require("./config/db");
const models = require("./models");
const resolvers = require("./resolvers");
const typeDefs = require("./types");

connectDb();

const { permissions } = require("./permissions");
const { loggerInfo } = require("./config/logger");

const port = 4000;


const server = new ApolloServer({
    schema: applyMiddleware(
        buildSubgraphSchema([{ typeDefs, resolvers }]),
        permissions
    ),
    context: ({ req }) => {
        const user = req.headers.user ? JSON.parse(req.headers.user) : null;
        const userIpPassedByGateway = req.headers.userippassedbygateway;
        const userAgent = req.headers.useragent
        return { models, user, userIpPassedByGateway, userAgent };
    }
});

server.listen({ port }).then(({ url }) => {
    loggerInfo(`Accounts service ready at ${url}`);
});