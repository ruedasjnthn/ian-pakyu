const { and, or, rule, shield } = require("graphql-shield");

function getPermissions(user) {
    if (user && user["https://vaipai.xaasfarm.com/graphql"]) {
        return user["https://vaipai.xaasfarm.com/graphql"].permissions;
    }
    return [];
}

const isAuthenticated = rule()(async (parent, args, { user, models }) => {
    const Hash = user["https://vaipai.xaasfarm.com/graphql"].Hash;

    const userId = user.sub;
    const dbUser = await models.User.findById(userId, 'Hash').exec();

    if (user !== null && Hash === dbUser.Hash) {
        return user !== null;
    }
});

const forbid = rule()(async (parent, args, { user, models }) => {
    return null;
});

const permissions = shield({
    Query: {
    //     aiMenuItems: isAuthenticated,
    //     Csvs: isAuthenticated
    },
    Mutation: {
        // uploadCsv: isAuthenticated,
        // finishCsvUpload: isAuthenticated,
        // createCsv: forbid,
        // updateCsv: forbid,
        // deleteCsv: forbid
    },
});

module.exports = { permissions };