'use strict';
require("dotenv").config();
const { ApolloServer } = require('@apollo/server');
const { ApolloGateway, RemoteGraphQLDataSource, IntrospectAndCompose } = require('@apollo/gateway');
const { ApolloServerPluginLandingPageDisabled } = require('@apollo/server/plugin/disabled');
const { expressMiddleware } = require('@apollo/server/express4');
const cors = require('cors');
const express = require('express');
const { EventEmitter } = require('events');
const { expressjwt: jwt } = require("express-jwt");
const timeout = require('connect-timeout');
const bodyParser = require('body-parser');

const biggerEventEmitter = new EventEmitter();
biggerEventEmitter.setMaxListeners(30);

const app = express();
const port = process.env.GwPort;
const haltOnTimedout = (req, res, next) => {
  if (!req.timedout) {
    next();
  }
}

app.use(express.json({ limit: '50mb' }));
app.use(timeout(300000));
app.use(haltOnTimedout);

sleep(2000);
const gateway = new ApolloGateway({
  supergraphSdl: new IntrospectAndCompose({
    subgraphs: [
      { name: 'auth', url: process.env.AuthService },
      { name: 'import', url: process.env.ImportService },
      { name: 'help', url: process.env.HelpService },
      { name: 'ai', url: process.env.AiService },
      { name: 'issue', url: process.env.IssueService },
      { name: 'print', url: process.env.PrintService },
      { name: 'batch', url: process.env.BatchService }
    ],
  }),
  buildService({ name, url }) {
    return new RemoteGraphQLDataSource({
      url,
      willSendRequest({ request, context }) {
        request.http.headers.set(
          "user",
          context.user ? JSON.stringify(context.user) : null
        );
      }
    });
  }
});

(async () => {
  const plugins = [ApolloServerPluginLandingPageDisabled()];

  const server = new ApolloServer({
    gateway,
    debug: true,
    // Subscriptions are unsupported but planned for a future Gateway version.
    subscriptions: false,
    plugins
  });

  await server.start();

  app.use(
    jwt({
      secret: process.env.JwtToken,
      algorithms: ["HS256"],
      credentialsRequired: false,
    }),
    cors(),
    bodyParser.json(),
    expressMiddleware(server, {
      context: async ({ req, reqs }) => ({
        user: req.auth
      }),
    }),
  );

  app.listen({ port }, () =>
    console.log(`Server ready at http://localhost:${port}/graphql`)
  );

})();


function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}
