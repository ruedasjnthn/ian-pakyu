'use strict';
require("dotenv").config();
const { ApolloServer } = require('apollo-server-express');
const { ApolloGateway, RemoteGraphQLDataSource } = require('@apollo/gateway');
const cors = require('cors');
const express = require('express');
const expressJwt = require("express-jwt");
const timeout = require('connect-timeout');

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
app.use(cors());
app.use(
  expressJwt({
    secret: process.env.JwtToken,
    algorithms: ["HS256"],
    credentialsRequired: false
  })
);

sleep(2000);
const gateway = new ApolloGateway({
  serviceList: [
    { name: 'auth', url: process.env.AuthService },
    { name: 'import', url: process.env.ImportService },
    { name: 'issue', url: process.env.IssueService },
    { name: 'print', url: process.env.PrintService },
    { name: 'batch', url: process.env.BatchService }
  ],
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
  const apolloServer = new ApolloServer({
    gateway,
    subscription: false,
    context: ({ req }) => {
      const user = req.user || null;
      return { user };
    }
  });

  await apolloServer.start();
  apolloServer.applyMiddleware({ app });

  app.listen({ port }, () =>
    console.log(`Server ready at http://localhost:${port}${apolloServer.graphqlPath}`)
  );

})();


function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}
