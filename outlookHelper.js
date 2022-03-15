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
    saveValuesToCookie(response, res)
    res.send(redirectPage);
  }).catch((error) => {
    console.log(error);
    return null
  });

  return accessToken
};

const saveValuesToCookie = (response, res) => {
  if (process.env.LOCAL_DEV === 'true')
    res.cookie('access_token', response.accessToken, { maxAge: 60 * 60 * 24 * 7 });
  if (process.env.DEV === 'true')
    res.cookie('access_token', response.accessToken, { maxAge: 60 * 60 * 24 * 7, domain: 'app-dev.aktenplatz.de' });
  else
    res.cookie('access_token', response.accessToken, { maxAge: 60 * 60 * 24 * 7, domain: 'app.aktenplatz.de' });
}

const redirectPage = `
<html>
  <script>
  window.close();
  </script>
  <head></head><body><div>    
    <div style="display:flex; flex-direction:column; width: 120px;">
        Success!
        <button onclick="window.close()" style="height:20px">
            Close
        </button>
    </div>
</div></body></html>`;

module.exports = {
  getTokenFromCode,
  redirectPage
};
