
const { OutlookContactSync } = require('../../Helper/OutlookContactSyncHelper')
const { clientGqlMutate } = require('../../Helper/gqlClientHelper')
const { gql } = require('apollo-server-express')
const { OutlookSyncStatusTypes } = require('../../constants/outlook')
const { loggerInfo, loggerError, logger } = require('../../config/logger')

// let onInitProcess = []

// const removeInProcessInit = (syncId) => {
//   const newOnProcess = onInitProcess.filter(id => id !== syncId)
//   onInitProcess = newOnProcess
// }

const initSyncIdsOnProcess = new Set([])

const removeInProcessSync = (syncId) => initSyncIdsOnProcess.delete(syncId);
const addInProcessingSyncs = (syncId) => initSyncIdsOnProcess.add(syncId)
const isSyncNotProcessing = (syncId) => syncId && !initSyncIdsOnProcess.has(syncId)


async function runReadyToInitializeContact() {
  try {
    const outlookContactSyncs = await OutlookContactSync.find(
      { status: OutlookSyncStatusTypes.READY_TO_INITIALIZE },
      'status projectId nextLink'
    ).limit(3)

    loggerInfo('runReadyToInitializeContact', { outlookContactSyncs, initSyncIdsOnProcess })

    for (const outlookContactSync of outlookContactSyncs) {

      const outlookContactSyncId = outlookContactSync ? String(outlookContactSync.id) : undefined;

      const loggerId = 'runReadyToInitializeContact ' + outlookContactSyncId;
      loggerInfo(loggerId, {
        outlookContactSync,
        outlookContactSyncId,
        initSyncIdsOnProcess
      })

      const canExecuteInit = isSyncNotProcessing(outlookContactSyncId)
      loggerInfo(loggerId, { canExecuteInit })

      if (canExecuteInit) {
        try {
          loggerInfo(loggerId + ' CALLING INIT')
          addInProcessingSyncs(outlookContactSyncId)

          const mutationObject = {
            mutation: gql`
            mutation initializeContactSyncForCron(
              $projectId: ID!,
              $outlookContactSyncId: ID!,
              $nextLink: String
            ) {
              initializeContactSyncForCron(
                projectId: $projectId,
                outlookContactSyncId: $outlookContactSyncId,
                nextLink: $nextLink,
              )
            }
          `,
            variables: {
              "projectId": outlookContactSync.projectId,
              "outlookContactSyncId": outlookContactSyncId,
              "nextLink": outlookContactSync.nextLink,
            },
          }
          loggerInfo(loggerId, { mutationObject })

          const { data, ...rest } = await clientGqlMutate(mutationObject)
          loggerInfo(loggerId + ' done init', { data, rest })

          if (data && data.initializeContactSyncForCron)
            removeInProcessSync(data.initializeContactSyncForCron)

        } catch (err) {
          loggerError(loggerId + ' runReadyToInitializeContact ERROR: ', {
            errMsg: err.message,
            err,
            outlookContactSyncId
          })

          removeInProcessSync(outlookContactSyncId);

          await OutlookContactSync.updateOne(
            { _id: outlookContactSyncId },
            {
              started: false,
              finished: true,
              status: OutlookSyncStatusTypes.FAILED_INITIALIZING,
              errMessage: 'cron error: ' + err.message
            },
          )

        }
      }
    }
  } catch (e) {
    loggerError('runReadyToInitializeContact ERROR: ', e.message)
  }
}


module.exports = {
  runReadyToInitializeContact,
}
