require("dotenv").config();
const client = require("@mailchimp/mailchimp_marketing");
const { loggerInfo } = require('../config/logger')

async function addListMember(email_address) {
    let isDev = process.env.Dev;
    loggerInfo(`Is Development? :: ${isDev}`)
    if (isDev !== "true") {
        let list_id = process.env.MAILCHIMP_LIST_ID
        let status = process.env.MAILCHIMP_STATUS

        client.setConfig({
            apiKey: process.env.MAILCHIMP_API_KEY,
            server: process.env.MAILCHIMP_SERVER,
        });

        await client.lists.addListMember(list_id, {
            "email_address": `${email_address}`,
            "status": `${status}`
        });
    }
}

module.exports = {
    addListMember
}