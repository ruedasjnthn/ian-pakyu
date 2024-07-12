require("dotenv").config();
const fs = require('fs')
const path = require('path');
const { loggerInfo } = require("../config/logger");
const { sendMail } = require("./mailHelper")

const getDomain = () => {
    let domain = "https://app.aktenplatz.de/";

    if (process.env.IJ_DEV === "true" || process.env.LOCAL_DEV === "true") {
        domain = "http://localhost:8081/"
    } else if (process.env.Dev === "true") {
        domain = "https://app-dev.aktenplatz.de/"
    }

    return domain
}

const getRedirectUrlForAcceptInvite = ({
    toMail,
    loginToken,
    projectId,
    languageCode,
    inviteToken,
}) => {
    let url = getDomain()
        + "otp?email=" + toMail
        + "&token=" + loginToken
        + "&acceptInvite=true"
        + "&projectId=" + projectId
        + "&languageCode=" + languageCode
        + "&inviteToken=" + inviteToken
    return url
}

const sendLoginMail = (toMail, loginToken, lng, acceptInvite) => {
    const language = lng && lng.split('-')[0];
    loggerInfo('language', { lng, language })

    var fileName = './mailTemplates/LoginMail_en.txt';
    var subject = "aktenplatz.de - Login Information";
    if (language === "de") {
        fileName = './mailTemplates/LoginMail_de.txt';
        subject = "aktenplatz.de - Anmelden ";
    }
    var text = fs.readFileSync(path.resolve(__dirname, fileName), 'utf8');

    text = text.replace(/#mail#/g, toMail);
    text = text.replace(/#token#/g, loginToken);


    const loginUrl = getDomain()
        + "login?mail=" + toMail
        + "&token=" + loginToken

    const inviteUrl = !!acceptInvite && getRedirectUrlForAcceptInvite({
        toMail,
        loginToken,
        projectId: acceptInvite.projectId,
        languageCode: acceptInvite.languageCode,
        inviteToken: acceptInvite.token,
    })

    const url = acceptInvite ? inviteUrl : loginUrl
    loggerInfo('sendLoginMail url', {
        loginUrl,
        inviteUrl,
        url
    })

    text = text.replace(/#url#/g, url);

    sendMail(toMail, subject, text);
}

const sendNewAccountMail = (toMail, loginToken, lng, acceptInvite) => {
    const language = lng && lng.split('-')[0];
    var fileName = './mailTemplates/LoginMail_en.txt';
    var subject = "aktenplatz.de - Welcome to aktenplatz.de";
    if (language === "de") {
        fileName = './mailTemplates/LoginMail_de.txt';
        subject = "aktenplatz.de - Willkommen bei aktenplatz.de";
    }
    var text = fs.readFileSync(path.resolve(__dirname, fileName), 'utf8');

    text = text.replace(/#mail#/g, toMail);
    text = text.replace(/#token#/g, loginToken);


    let searchValues = "login?mail=" + toMail + "&token=" + loginToken

    if (acceptInvite)
        searchValues += "&acceptInvite=true"
            + "&projectId=" + acceptInvite.projectId
            + "&languageCode=" + acceptInvite.languageCode
            + "&inviteToken=" + acceptInvite.token

    loggerInfo({ searchValues })

    let domain = "https://app.aktenplatz.de/";

    if (process.env.IJ_DEV === "true" || process.env.LOCAL_DEV === "true") {
        domain = "http://localhost:8081/"
    } else if (process.env.Dev === "true") {
        domain = "https://app-dev.aktenplatz.de/"
    }

    const url = domain + searchValues

    text = text.replace(/#url#/g, url);
    sendMail(toMail, subject, text);
}

const sendUpdateAccountMail = (toMail, currentEmail, newToken, lng) => {
    const language = lng && lng.split('-')[0];

    var fileName = './mailTemplates/UpdateEmail_en.txt';
    var subject = "aktenplatz.de - Confirm update email";
    if (language === 'de') {
        fileName = './mailTemplates/UpdateEmail_de.txt';
        subject = "aktenplatz.de - Neue E-Mail Adresse bestätigen";
    }

    let text = fs.readFileSync(path.resolve(__dirname, fileName), 'utf8');

    var domain = "https://app-dev.aktenplatz.de"

    if (process.env.Dev === "false") {
        domain = "https://app.aktenplatz.de"
    }
    if (process.env.LOCAL_DEV === "true") {
        domain = "http://localhost:8081"
    }

    var url = "/confirm-update-email?mail=" + toMail
        + "&token=" + newToken
        + "&currentEmail=" + currentEmail;

    if (process.env.LOCAL_DEV === "true")
        loggerInfo({ link: domain + url })

    const confirmUrl = domain + url

    text = text.replace(/#user#/g, currentEmail);
    text = text.replace(/#newMail#/g, toMail);
    text = text.replace(/#url#/g, confirmUrl);

    sendMail(toMail, subject, text);
}


module.exports = {
    getDomain,
    getRedirectUrlForAcceptInvite,
    sendLoginMail,
    sendNewAccountMail,
    sendUpdateAccountMail
}