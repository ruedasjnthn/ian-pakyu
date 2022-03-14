require('isomorphic-fetch');
const msal = require('@azure/msal-node');

var clientId = process.env.MICROSOFT_CLIENT_ID;
var clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
var tenantId = process.env.MICROSOFT_TENANT_ID;
var redirectUri = process.env.MICROSOFT_REDIRECT_URI;

var scopes = [
  'user.read',
  "offline_access",
  "Calendars.Read",
  "Calendars.Read.Shared",
  "Tasks.Readwrite"
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
        console.log({ message, loglevel, containsPii });
      },
      piiLoggingEnabled: false,
      logLevel: msal.LogLevel.Verbose,
    }
  }
};

const cca = new msal.ConfidentialClientApplication(config);

const getTokenFromCode = (req, res) => {
  const code = req.query.code;

  const tokenRequest = {
    code,
    scopes,
    redirectUri,
  };

  const accessToken = cca.acquireTokenByCode(tokenRequest).then((response) => {
    console.log("\nResponse: \n:", response);
    saveValuesToCookie(response, res, code)
    res.sendStatus(200);
    // todo: add a html with button to redirect back to the app
  }).catch((error) => {
    console.log(error);
    return null
  });

  return accessToken
};

const saveValuesToCookie = (response, res, code) => {
  res.cookie('code', code, { maxAge: 3600000 })
  res.cookie('access_token', response.accessToken, { maxAge: 3600000, httpOnly: true });
  res.cookie('email', response.account.username, { maxAge: 360000, httpOnly: true });
}

module.exports = {
  getTokenFromCode,
};
