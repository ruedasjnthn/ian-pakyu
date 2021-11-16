'use strict';
require("dotenv").config();
const { ApolloServer } = require('apollo-server-express');
const { ApolloGateway, RemoteGraphQLDataSource } = require('@apollo/gateway');
const express = require('express');
const expressJwt = require("express-jwt");

const app = express();
const port = 80;

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
    { name: 'auth', url: 'http://auth:4000/' },
    { name: 'video', url: 'http://video:4001/' },
    { name: 'ai', url: 'http://ai:4002/' },
    { name: 'products', url: 'http://products:4003/' },
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
