const ApolloClient = require("apollo-client").ApolloClient;
const fetch = require("node-fetch");
const createHttpLink = require("apollo-link-http").createHttpLink;
const InMemoryCache = require("apollo-cache-inmemory").InMemoryCache;

/**
 * Helper method to call mutate api
 * 
 * @param {*} mutate_object 
 * @returns 
 */
async function client_gql_mutate(url, mutate_object) {
    const httpLink = createHttpLink({
        uri: url,
        fetch: fetch
    });

    const client = new ApolloClient({
        link: httpLink,
        cache: new InMemoryCache()
    });

    return await client.mutate(mutate_object);
}

module.exports = {
    client_gql_mutate
}