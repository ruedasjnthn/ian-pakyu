const { and, or, rule, shield } = require('graphql-shield');
const { loggerInfo } = require('./config/logger');

function getPermissions(user) {
  if (user && user['https://backend.aktenplatz.de/graphql']) {
    return user['https://backend.aktenplatz.de/graphql'].permissions;
  }
  return [];
}

const isAuthenticated = rule()(async (parent, args, { user, models }) => {
  const Hash = user['https://backend.aktenplatz.de/graphql'].Hash;

  loggerInfo(Hash);
  const userId = user.sub;
  const dbUser = await models.User.findById(userId, 'Hash').exec();

  if (user !== null && Hash === dbUser.Hash) {
    loggerInfo('jwt valid');
    return user !== null;
  }
});

const canReadAnyAccount = rule()((parent, args, { user }) => {
  const userPermissions = getPermissions(user);
  return userPermissions.includes('read:any_account');
});

const canReadOwnAccount = rule()((parent, args, { user }) => {
  const userPermissions = getPermissions(user);
  return userPermissions.includes('read:own_account');
});

const isReadingOwnAccount = rule()((parent, { id }, { user }) => {
  return user && user.sub === id;
});

const isOwnAccount = rule()(async (parent, { id, email }, { models, user }) => {
  const userFound = await models.User.findOne(
    { _id: id || user.sub, Email: email },
    'Email',
  );
  return Boolean(userFound);
});

const isChangeEmailAuthorized = rule()(
  async (parent, { id, email }, { models, user }) => {
    const userFound = await models.User.findOne(
      { _id: id || user.sub, 'changeEmailSchema.newEmail': email },
      'Email',
    );
    return Boolean(userFound);
  },
);

const permissions = shield({
  Query: {
    // account: or(and(canReadOwnAccount, isReadingOwnAccount), canReadAnyAccount),
    currentUser: isAuthenticated,
    userInfo: and(isAuthenticated, isOwnAccount),
    generateToken: isAuthenticated,
  },
  Mutation: {
    updateUser: isAuthenticated,
    deleteUser: and(isAuthenticated, isOwnAccount),
    updateUserEmail: and(isAuthenticated, isOwnAccount),
    confirmNewEmail: isChangeEmailAuthorized,
  },
});

module.exports = { permissions };
