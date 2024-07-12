const { getClientWithUpdateToken } = require('../../../../helper/AuthHelper');
const { ApolloError } = require('apollo-server-express');
const { getProjectCategories } = require('../../../../helper/CategoryHelper');
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { firstInit } = require('./sync-init-first');
const { syncCategories } = require('./sync-categories');
const { updateInit } = require('./sync-init-update');
const { OutlookCalendarSyncStatus } = require('../../../../constants/outlook-calendar');

const initializeSync = async (_, { projectId, outlookSyncId }, { models }) => {
  try {
    const start = Date.now()
    const lastOutlookSyncFound = await models.OutlookSync.findById(
      outlookSyncId,
      'initStartAt categoriesSyncedAt isFirstBatchInit nextLink'
    )
    if (!lastOutlookSyncFound) throw new ApolloError('outlook_sync_not_found')

    const lastSyncInitStartAt = lastOutlookSyncFound.initStartAt
    const categoriesSyncedAt = lastOutlookSyncFound.categoriesSyncedAt
    const isFirstBatchInit = lastOutlookSyncFound.isFirstBatchInit
    const nextLink = lastOutlookSyncFound.nextLink

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId, projectId },
      {
        started: true,
        finished: false,
        initStartAt: new Date(),
        lastSyncInitStartAt,
        status: OutlookCalendarSyncStatus.INITIALIZING,
      }
    )

    const projectFound = await models.Project.findById(
      projectId,
      'outlook eventCategories timeZone outlook prefixes'
    )
    if (!projectFound) throw new ApolloError('no_project_found')

    const projectOutlook = await projectFound.outlook || {}
    const refreshToken = await projectOutlook.refreshToken
    const accessToken = await projectOutlook.accessToken
    const outlookAccountId = await projectOutlook.accountId
    const calendarId = await projectOutlook.calendarId

    loggerInfo('initializeSync', {
      projectOutlook,
      refreshToken,
      accessToken,
      outlookAccountId,
    })
    const projectEventCategories = await projectFound.eventCategories || []

    const client = await getClientWithUpdateToken({
      accessToken,
      refreshToken,
      models,
      projectId
    })

    if (!client || !accessToken) throw new ApolloError('Null Client or NO Access Token')

    // only sync categories in the first batch of init
    if (isFirstBatchInit) {
      await syncCategories({
        categoriesSyncedAt,
        client,
        models,
        projectEventCategories,
        projectId,
        outlookAccountId
      })
    }

    // const projectFound = await models.Project.findById(
    //   projectId,
    //   'timeZone outlook prefixes'
    // )

    const projectCategories = await getProjectCategories({ projectId })

    const outlookSyncFound = await models.OutlookSync.findById(
      outlookSyncId,
      'isFirstSync deltaLink nextLink'
    )

    if (outlookSyncFound.isFirstSync) {

      await firstInit({
        client,
        calendarId,
        nextLink,
        models,
        outlookSyncId,
        projectId,
        start,
        projectCategories
      })

    } else {

      await updateInit({
        projectCategories,
        client,
        outlookSyncFound,
        models,
        outlookSyncId,
        projectId,
        lastSyncInitStartAt,
      })

    }

    loggerInfo('--- done init -----')

    return outlookSyncId
  }
  catch (e) {
    loggerError('ERROR: initializeSyncForCron,', { e })
    await models.OutlookSync.updateOne(
      { _id: outlookSyncId, projectId },
      {
        started: false,
        finished: true,
        status: OutlookCalendarSyncStatus.FAILED_INITIALIZING,
        errMessage: e.message,
        failedAt: new Date(),
        nextLink: null,
        isFirstBatchInit: false,
      }
    )
    return e
  }
}

module.exports = {
  initializeSync,
}
