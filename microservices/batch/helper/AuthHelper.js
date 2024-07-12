require('isomorphic-fetch');
const msal = require('@azure/msal-node');
const { Client } = require("@microsoft/microsoft-graph-client");
const { loggerInfo, loggerError } = require('../config/logger');

var clientId = process.env.MICROSOFT_CLIENT_ID;
var clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
var tenantId = process.env.MICROSOFT_TENANT_ID;
var redirectUri = process.env.MICROSOFT_REDIRECT_URI;

var scopes = [
  "offline_access",
  "user.read",
  "Calendars.ReadWrite",
  "Calendars.ReadBasic",
  "Calendars.Read.Shared",
  "Tasks.Readwrite",
  "MailboxSettings.ReadWrite",
  "Contacts.Read",
  "Contacts.ReadWrite",
  "Mail.ReadBasic",
  "Mail.ReadWrite",
];

const config = {
  auth: {
    clientId,
    authority: tenantId,
    clientSecret
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        loggerInfo({ message, loglevel, containsPii });
      },
      piiLoggingEnabled: false,
      logLevel: msal.LogLevel.Verbose,
    }
  }
};

const cca = new msal.ConfidentialClientApplication(config);
// const cca = new msal.PublicClientApplication(config);

const getOptions = (token) => ({
  authProvider: (done) => {
    done(null, token);
  }
})

const getClient = async (token) => {
  try {
    const options = getOptions(token)
    const client = Client.init(options);
    const me = await client.api('/me').get();
    loggerInfo('getClient client ', { me })
    return client
  } catch (e) {
    loggerError('getClient ERROR ', { e })
    return null
  }
}

const getClientWithUpdateToken = async ({ projectId, models, accessToken, refreshToken }) => {
  loggerInfo('------getClientWithUpdateToken------')
  try {
    loggerInfo(`AccessToken is ${!!accessToken ? 'not ' : ''} null or undefined`)
    let client = await getClient(accessToken)
    loggerInfo('client', client)
    if (client === null) {
      const res = await saveAccessTokenFromRefreshToken({ models, projectId, refreshToken });
      const newAccessToken = res.accessToken;
      client = await getClient(newAccessToken)
      return client
    }
    loggerInfo('client', client)

    return client
  } catch (e) {
    loggerError('/!\ ---ERROR--- /!\ (getClientWithUpdateToken) ', { e })
    return e
  }
}

const getAuthUrl = async () => {
  const authCodeUrlParameters = {
    scopes,
    redirectUri,
  };
  // get url to sign user in and consent to scopes needed for application
  const link = await cca.getAuthCodeUrl(authCodeUrlParameters).then((response) => {
    loggerInfo(response)
    return response
  }).catch((error) => {
    loggerError({ error })
    return null;
  });

  return link
};

const getTokenFromCode = async (code) => {
  const tokenRequest = {
    code,
    scopes,
    redirectUri,
  };
  let ccaResponse = null;

  ccaResponse = await cca.acquireTokenByCode(tokenRequest)
    .then((response) => {
      loggerInfo("\nResponse: \n:", response);

      const refreshToken = () => {
        const tokenCache = cca.getTokenCache().serialize();
        const refreshTokenObject = (JSON.parse(tokenCache)).RefreshToken
        const refreshToken = refreshTokenObject[Object.keys(refreshTokenObject)[0]].secret;
        return refreshToken;
      }

      loggerInfo({ refreshToken: refreshToken() })
      //     accessToken,
      //     refreshToken:refreshToken()
      // }
      return {
        ...response,
        refreshToken: refreshToken()
      };
    }).catch((error) => {
      loggerError({ error });
      return null
    });

  if (ccaResponse === null) {
    ccaResponse = await cca.acquireTokenSilent(tokenRequest)
  }

  return ccaResponse
};

const getRefreshToken = async (refreshToken) => {
  try {
    const silentRequest = {
      scopes,
      refreshToken,
    }

    const token = await cca.acquireTokenByRefreshToken(silentRequest)
      .then(res => {
        loggerInfo('--- refresh token success ---')
        return res.accessToken
      })
      .catch((e) => {
        loggerError('error', { e })
        return null
      })

    loggerInfo('accessToken from refresh token', token)

    return token
  } catch (e) {
    loggerError('getRefreshToken ERROR', { e })
    return e
  }
};

const getAccessTokenfromRefreshToken = async (refreshToken) => {
  try {
    const silentRequest = {
      scopes,
      refreshToken,
    }

    const token = await cca.acquireTokenByRefreshToken(silentRequest)
      .then(res => {
        loggerInfo('--- refresh token success ---')
        return res.accessToken
      })
      .catch((e) => {
        loggerError('error', { e })
        return null
      })

    loggerInfo('accessToken from refresh token', token)

    return token
  } catch (e) {
    loggerError('e', { e });
    return e;
  }
};

const getMe = async (client) => {
  try {
    const me = await client.api('/me').get();
    loggerInfo({ me })
    return {
      displayName: me.displayName,
      mail: me.mail,
      accountId: me.id
    }
  } catch (e) {
    loggerError('!ERROR! getMe: ', { e })
    return e
  }
}

const saveAccessTokenFromRefreshToken = async ({ projectId, refreshToken, models }) => {
  let refToken = refreshToken;

  if (refreshToken) {
    const projectFound = await models.Project.findById(projectId, 'outlook')
    refToken =
      projectFound &&
      projectFound.outlook &&
      projectFound.outlook.refreshToken;
  }

  const newAccessToken = await getAccessTokenfromRefreshToken(refToken)
  loggerInfo({ newAccessToken })
  await models.Project.updateOne(
    { _id: projectId },
    { 'outlook.accessToken': newAccessToken }
  )
  return { accessToken: newAccessToken }
}



module.exports = {
  getMe,
  getClient,
  getAuthUrl,
  getTokenFromCode,
  getRefreshToken,
  saveAccessTokenFromRefreshToken,
  getClientWithUpdateToken
};
