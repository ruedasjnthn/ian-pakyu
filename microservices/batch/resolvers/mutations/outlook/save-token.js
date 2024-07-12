const { loggerInfo, loggerError } = require('../../../config/logger');
const { getTokenFromCode, getMe, getClient } = require('../../../helper/AuthHelper');
const { OutlookSyncStatusTypes } = require('../../../constants/outlook');
const { ApolloError } = require('apollo-server-express');


const saveOutlookAccessToken = async (_, { projectId, code }, { models, user }) => {
  try {
    loggerInfo('----------saveOutlookAccessToken-------')
    const ongoingSync = await models.OutlookSync.findOne({
      projectId,
      status: {
        $in: [
          OutlookSyncStatusTypes.INITIALIZING,
          OutlookSyncStatusTypes.PENDING,
          OutlookSyncStatusTypes.READY_TO_INITIALIZE,
          OutlookSyncStatusTypes.READY_TO_SYNC,
          OutlookSyncStatusTypes.SYNCING,
          OutlookSyncStatusTypes.DISABLING,
          OutlookSyncStatusTypes.AUTHORIZING,
          OutlookSyncStatusTypes.FAILED_FIRST_SYNCING,
          OutlookSyncStatusTypes.FAILED_FIRST_INITIALIZING,
        ]
      }
    }, 'id status')

    if (ongoingSync) {
      if (
        ongoingSync.status === OutlookSyncStatusTypes.FAILED_FIRST_SYNCING ||
        ongoingSync.status === OutlookSyncStatusTypes.FAILED_FIRST_INITIALIZING
      )
        throw new ApolloError('reenable_sync_in_settings')
      else if (ongoingSync.status === OutlookSyncStatusTypes.DISABLING)
        throw new ApolloError('sync_is_disabling')
      else if (ongoingSync.status === OutlookSyncStatusTypes.AUTHORIZING)
        throw new ApolloError('sync_is_authorizing')
      else throw new ApolloError('sync_is_still_running')
    }

    await models.OutlookSync.updateOne(
      { projectId, },
      { status: OutlookSyncStatusTypes.AUTHORIZING }
    )
    const { accessToken, refreshToken } = await getTokenFromCode(code)
    const client = await getClient(accessToken)
    const me = await getMe(client)

    loggerInfo({ me, client })

    if (!me) {
      await models.Project.updateOne(
        { _id: projectId, },
        { $set: { "outlook.authErrorAt": new Date() } }
      )
      throw new ApolloError('get_me__is_null')
    }

    const userFound = await models.User.findOne(
      {
        _id: { $ne: user.sub },
        'outlookEmails.accountId': me.accountId
      },
      'outlookEmails'
    )

    loggerInfo({ userFound })

    if (userFound) {
      await models.Project.updateOne(
        { _id: projectId, },
        { $set: { "outlook.authErrorAt": new Date() } }
      )
      throw new ApolloError('outlook_account_authorized_by_other_user_already')
    }

    await models.User.updateOne({ _id: user.sub, "outlookEmails.accountId": { $ne: me.accountId } }, {
      $push: {
        outlookEmails: {
          mail: me.mail,
          accountId: me.accountId,
        }
      }
    })

    await models.Project.updateOne(
      { _id: projectId },
      {
        $set: {
          'outlook.accessToken': accessToken,
          'outlook.refreshToken': refreshToken,
          'outlook.authErrorAt': null,
          ...me && {
            'outlook.accountId': me.accountId,
            'outlook.accountMail': me.mail,
            'outlook.accountName': me.displayName,
          },
        }
      }
    )

    await models.OutlookSync.updateOne(
      { projectId, },
      { status: OutlookSyncStatusTypes.SUCCESS }
    )
    return 'outlook_access_token_saved'
  }
  catch (e) {
    loggerError('!ERROR: (saveOutlookAccessToken) ', { e })
    return e
  }
};

module.exports = {
  saveOutlookAccessToken,
}
