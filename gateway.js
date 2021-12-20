'use strict';
require("dotenv").config();
const { ApolloServer } = require('apollo-server-express');
const { ApolloGateway, RemoteGraphQLDataSource } = require('@apollo/gateway');
const cors = require('cors');
const express = require('express');
const expressJwt = require("express-jwt");

const app = express();
const port = 8080;

app.use( cors() );
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
    { name: 'auth', url: 'http://localhost:4000/' },
    { name: 'import', url: 'http://localhost:4001/' },
    { name: 'issue', url: 'http://localhost:4002/' },
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
    subscriptions: false,
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
