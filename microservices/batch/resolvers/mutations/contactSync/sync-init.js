const { getClientWithUpdateToken } = require('../../../helper/AuthHelper');
const { getOutlookContactsFirstTime, getOutlookContactsChanges } = require('../../../helper/OutlookContactHelper');
const { OutlookSyncStatusTypes } = require('../../../constants/outlook');
const { ApolloError } = require('apollo-server-express');
const { loggerInfo, loggerError } = require('../../../config/logger');

const firstInit = async ({
  client,
  nextLink,
  models,
  outlookContactSyncId,
  projectId,
  start,
}) => {
  const {
    outlookContactsResult,
    newNextLink,
    deltaLink,
  } = await getOutlookContactsFirstTime({
    client,
    nextLink,
    projectId
  })

  const outlookContactRes = outlookContactsResult || []

  const outsync = await models.OutlookContactSync.updateOne(
    { _id: outlookContactSyncId, projectId },
    {
      status: Boolean(newNextLink) ? OutlookSyncStatusTypes.READY_TO_INITIALIZE : OutlookSyncStatusTypes.READY_TO_SYNC,
      nextLink: Boolean(newNextLink) ? newNextLink : null,
      ...deltaLink && { newDeltaLink: deltaLink },
      initEndAt: new Date(),
      $addToSet: {
        contacts: { $each: outlookContactRes }
      },
    }
  )

  loggerInfo('outSync', {
    outsync,
    status: newNextLink ? OutlookSyncStatusTypes.READY_TO_INITIALIZE : OutlookSyncStatusTypes.READY_TO_SYNC,
  })

  loggerInfo('success fetch', { totalTime: Date.now() - start, outlookContactSyncId, contactsLength: outlookContactRes.length })

}

const updateInit = async ({
  client,
  outlookSyncFound,
  models,
  outlookContactSyncId,
  projectId,
}) => {
  const {
    newNextLink,
    newDeltaLink,
    outlookContactIdsDeleted,
    outlookContactsUpdated,
  } = await getOutlookContactsChanges({
    client,
    apiLink: outlookSyncFound.nextLink || outlookSyncFound.deltaLink,
    projectId,
  })

  const outsync = await models.OutlookContactSync.updateOne(
    { _id: outlookContactSyncId, projectId },
    {
      status: Boolean(newNextLink) ? OutlookSyncStatusTypes.READY_TO_INITIALIZE : OutlookSyncStatusTypes.READY_TO_SYNC,
      nextLink: Boolean(newNextLink) ? newNextLink : null,
      ...newDeltaLink && { newDeltaLink },
      initEndAt: new Date(),
      $addToSet: {
        outlookContactIdsDeleted: { $each: outlookContactIdsDeleted || [] },
        outlookContactsUpdated: { $each: outlookContactsUpdated || [] },
      },
    }
  )

  loggerInfo('outSync', {
    outsync,
    status: OutlookSyncStatusTypes.READY_TO_SYNC,
  })
}

const initializeContactSyncForCron = async (_, { projectId, outlookContactSyncId, nextLink }, { models }) => {
  try {
    loggerInfo('-------- initialize sync -----------')
    const start = Date.now()
    await models.OutlookContactSync.updateOne(
      { _id: outlookContactSyncId, projectId },
      {
        started: true,
        finished: false,
        initStartAt: new Date(),
        status: OutlookSyncStatusTypes.INITIALIZING,
      }
    )

    const projFound = await models.Project.findById(projectId, 'outlook')
    let accessToken;
    const { accessToken: accTok, refreshToken } = await projFound && projFound.outlook || {};
    accessToken = await accTok;

    const client = await getClientWithUpdateToken({ accessToken, models, projectId, refreshToken })

    if (!client || !accessToken) throw new ApolloError('Null Client or NO Access Token')

    const outlookSyncFound = await models.OutlookContactSync.findById(
      outlookContactSyncId,
      'isFirstSync deltaLink nextLink'
    )

    if (outlookSyncFound.isFirstSync) {
      await firstInit({
        client,
        nextLink,
        models,
        outlookContactSyncId,
        projectId,
        start,
      })
    } else {
      await updateInit({
        client,
        outlookSyncFound,
        models,
        outlookContactSyncId,
        projectId,
      })

    }

    loggerInfo('--- done init -----')
    return outlookContactSyncId
  }
  catch (e) {
    loggerError('ERROR: initializeContactSyncForCron,', { e })
    await models.OutlookContactSync.updateOne(
      { _id: outlookContactSyncId, projectId },
      {
        started: false,
        finished: true,
        status: OutlookSyncStatusTypes.FAILED_INITIALIZING,
        failedAt: new Date(),
        nextLink: null
      }
    )
    return e
  }
}

module.exports = {
  initializeContactSyncForCron,
}
