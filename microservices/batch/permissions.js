const { and, or, rule, shield } = require("graphql-shield");
const mongoose = require('mongoose');
const { loggerInfo } = require("./config/logger");
const { UserRole } = require("./constants/project");

function getPermissions(user) {
    if (user && user["https://backend.aktenplatz.de/graphql"]) {
        return user["https://backend.aktenplatz.de/graphql"].permissions;
    }
    return [];
}

const isAuthenticated = rule()(async (parent, args, { user, models }) => {
    const Hash = user["https://backend.aktenplatz.de/graphql"].Hash;
    const userId = user.sub;
    const dbUser = await models.User.findById(userId, 'Hash').exec();

    if (user !== null && Hash === dbUser.Hash) {
        loggerInfo('jwt valid');
        return user !== null;
    }
});

const isCronAuthenticated = rule()(async (_, __, { user }) => {
    const cronUser = user['https://backend.aktenplatz.de/graphql']
    const secretUserId = cronUser && cronUser['secretUserId']
    const cronSecretUserId = process.env.CRON_SECRET_USER_ID

    return (Boolean(secretUserId) && Boolean(cronSecretUserId)) && secretUserId === cronSecretUserId;
});

const isProjectUser = rule()(async (_, { projectId }, { user, models }) => {

    const userId = user.sub;

    const projectFound = await models.Project.findOne(
        {
            _id: mongoose.Types.ObjectId(projectId),
            users: {
                $elemMatch: {
                    userId: mongoose.Types.ObjectId(userId),
                    status: { $ne: false },
                }
            }
        },
        'id'
    ).exec();

    return Boolean(projectFound)
});
const isProjectAdmin = rule()(async (_, { projectId }, { user, models }) => {
    const projectFound = await models.Project.findById(projectId, 'users');
    const projectUser = projectFound && projectFound.users.find(u => String(u.userId) === user.sub)
    const userRole = projectUser && projectUser.role

    return (userRole === UserRole.ADMINISTRATOR || userRole === UserRole.OWNER)
});

const forbid = rule()(async (parent, args, { user, models }) => {
    return null;
});

const permissions = shield({
    Query: {
        outlookAuthUrl: or(isAuthenticated, isCronAuthenticated),
        outlookCalendars: and(isAuthenticated, isProjectUser),
        outlookCalendarEvents: and(isAuthenticated, isProjectUser),
        outlookUser: and(isAuthenticated, isProjectUser),
        outlookSync: or(and(isAuthenticated, isProjectUser), isCronAuthenticated),
        outlookEvent: and(isAuthenticated, isProjectUser),
        outlookContacts: and(isAuthenticated, isProjectUser),
        outlookContactSync: or(and(isAuthenticated, isProjectUser), isCronAuthenticated),
        getOutlookApiResults: and(isAuthenticated, isProjectUser),
        getSubscription: and(isProjectUser),
        listSubscriptions: and(isProjectUser),
        projectBackupEnabled: and(isAuthenticated, isProjectUser),
        outlookTokenStatus: isAuthenticated,
        columnOutlookMails: and(isAuthenticated, isProjectUser),
        getTime:isAuthenticated,
        projectMailRules: and(isAuthenticated, isProjectUser),
        mailRuleTargetProjOpts: and(isAuthenticated, isProjectUser),
    },
    Mutation: {
        enableOutlookSync: and(isAuthenticated, isProjectUser),
        disableOutlookSync: and(isAuthenticated, isProjectUser),
        saveOutlookAccessToken: and(isAuthenticated, isProjectUser),
        updateProjectCalendarId: and(isAuthenticated, isProjectUser),

        initializeSyncForCron: or(and(isAuthenticated, isProjectUser), isCronAuthenticated),
        readyToInitializeSync: and(isAuthenticated, isProjectUser),
        firstCalendarSync: or(and(isAuthenticated, isProjectUser), isCronAuthenticated),
        syncCalendarUpdate: or(and(isAuthenticated, isProjectUser), isCronAuthenticated),
        syncUserContacts: and(isAuthenticated, isProjectUser),
        enableOutlookContactSync: and(isAuthenticated, isProjectUser),
        disableOutlookContactSync: and(isAuthenticated, isProjectUser),
        updateProjectContactId: and(isAuthenticated, isProjectUser),
        initializeContactSyncForCron: or(and(isAuthenticated, isProjectUser), isCronAuthenticated),
        readyToInitializeContactSync: and(isAuthenticated, isProjectUser),
        firstContactSync: or(and(isAuthenticated, isProjectUser), isCronAuthenticated),
        syncContactUpdate: or(and(isAuthenticated, isProjectUser), isCronAuthenticated),
        createMailSubscription: and(isAuthenticated, isProjectUser),
        recreateMailSubscription: or(and(isAuthenticated, isProjectUser), isCronAuthenticated),
        deleteSubscription: and(isAuthenticated, isProjectUser),
        saveExistingMailsFromOutlook: and(isAuthenticated, isProjectUser),
        triggerBackupProject: and(isAuthenticated, isProjectUser, isProjectAdmin),
        updateSubscriptionExpiration: or(and(isAuthenticated, isProjectUser), isCronAuthenticated),
        refreshMailSubscription: and(isAuthenticated, isProjectUser),

        changeProjectDefaultOutlookMailsColumn: and(isAuthenticated, isProjectUser),
        removeProjectDefaultOutlookMailsColumn: and(isAuthenticated, isProjectUser),
        changeOutlookMailColumn: isAuthenticated,
        removeOutlookMailColumn: isAuthenticated,

        createMailRule: and(isAuthenticated, isProjectUser),
        createMailRules: and(isAuthenticated, isProjectUser),
        updateMailRule: and(isAuthenticated),
        deleteMailRule: and(isAuthenticated),

        disconnectOutlookSync: and(isAuthenticated, isProjectUser),
    },
});

module.exports = { permissions };