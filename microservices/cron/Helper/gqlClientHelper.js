const { ApolloClient, InMemoryCache, from, createHttpLink } = require("@apollo/client");
const { setContext } = require("@apollo/client/link/context");
const fetch = require("node-fetch");
const { onError } = require('@apollo/client/link/error')
const { loggerInfo, loggerError } = require('../config/logger')

const uri = process.env.GatewayService;
const cronToken = process.env.CRON_JWT_TOKEN;
loggerInfo({ uri })

// Log any GraphQL errors or network error that occurred
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors)
    graphQLErrors.forEach(({ message, locations, path }) =>
      loggerError(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`)
    )
  if (networkError) loggerError(`[Network error]: ${JSON.stringify(networkError, null, 2)})`)
})

async function clientGqlMutate(mutationObject) {
  const httpLink = createHttpLink({
    uri,
    fetch: fetch
  });

  const authLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        authorization: cronToken ? `Bearer ${cronToken}` : "",
      }
    }
  });

  const client = new ApolloClient({
    link: from([errorLink, authLink.concat(httpLink)]),
    cache: new InMemoryCache()
  });

  return await client.mutate(mutationObject);
}

module.exports = {
  clientGqlMutate
}