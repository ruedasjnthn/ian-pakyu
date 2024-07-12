const { getClient } = require('../../helper/AuthHelper');
const { loggerError } = require('../../config/logger');
const { getUserContacts } = require('../../helper/ContactHelper');

const syncUserContacts = async (_, { projectId }, { models, user }) => {
    try {
        let accessToken;
        const projectFound = await models.Project.findById(
            projectId,
            'outlook'
          )
        const { accessToken: accTok, refreshToken } = await projectFound && projectFound.outlook || {};
        accessToken = await accTok;
        const client = await getClient(accessToken, refreshToken)
        const contacts = await getUserContacts(client, projectId);
    
        await models.Contact.insertMany(contacts)
        return true
    } catch (error) {
        loggerError({ error })
        return false
    }
}

module.exports = {
    syncUserContacts
}