
const { OutlookContactSync } = require('../../Helper/OutlookContactSyncHelper')
const { clientGqlMutate } = require('../../Helper/gqlClientHelper')
const { gql } = require('apollo-server-express')
const { OutlookSyncStatusTypes } = require('../../constants/outlook')
const { loggerInfo, loggerError } = require('../../config/logger')

// let onSyncProcess = []

// const removeInProcessSync = (syncId) => {
//   const newOnSyncProcess = onSyncProcess.filter(id => id !== syncId)
//   onSyncProcess = newOnSyncProcess
// }

const syncIdsOnProcess = new Set([])

const removeInProcessSync = (syncId) => syncIdsOnProcess.delete(syncId)
const addInProcessingSyncs = (syncId) => syncIdsOnProcess.add(syncId)
const isSyncNotProcessing = (syncId) => syncId && !syncIdsOnProcess.has(syncId)

async function runReadyToSyncContact() {
  try {
    const outlookReadyContactSyncs = await OutlookContactSync.find(
      { status: OutlookSyncStatusTypes.READY_TO_SYNC },
      'projectId isFirstSync status'
    ).limit(3)

    loggerInfo('runReadyToSyncContact', { outlookReadyContactSyncs, syncIdsOnProcess })


    for (const outlookReadyContactSync of outlookReadyContactSyncs) {

      const outlookReadyContactSyncId = outlookReadyContactSync ? String(outlookReadyContactSync._id) : undefined
  
      const loggerId = 'runReadyToSyncContact ' + outlookReadyContactSyncId;
      loggerInfo(loggerId, {
        outlookReadyContactSync,
        syncIdsOnProcess,
        outlookReadyContactSyncId
      })

      const canExecuteSync = isSyncNotProcessing(outlookReadyContactSyncId)
      loggerInfo(loggerId, { canExecuteSync })

      if (canExecuteSync) {
        try {
          loggerInfo(loggerId + ' CALLING SYNC')
          addInProcessingSyncs(outlookReadyContactSyncId)

          const firstContactSyncMutationObject = {
            mutation: gql`
            mutation firstContactSync(
              $projectId: ID!,
              $outlookContactSyncId: ID!,
            ) {
              firstContactSync(
                projectId: $projectId,
                outlookContactSyncId: $outlookContactSyncId,
              )
            }
        `,
            variables: {
              "projectId": outlookReadyContactSync.projectId,
              "outlookContactSyncId": outlookReadyContactSyncId,
            },
          }

          const syncContactUpdateMutationObject = {
            mutation: gql`
          mutation syncContactUpdate(
            $projectId: ID!,
            $outlookContactSyncId: ID!,
          ) {
            syncContactUpdate(
              projectId: $projectId,
              outlookContactSyncId: $outlookContactSyncId,
            )
          }
        `,
            variables: {
              "projectId": outlookReadyContactSync.projectId,
              "outlookContactSyncId": outlookReadyContactSyncId,
            },
          }

          const mutationObject = outlookReadyContactSync.isFirstSync
            ? firstContactSyncMutationObject
            : syncContactUpdateMutationObject
          loggerInfo(loggerId, { mutationObject })


          const { data, ...rest } = await clientGqlMutate(mutationObject)
          loggerInfo(loggerId + ' done sync', { data, rest })

          const outlookContactSyncId = outlookReadyContactSync.isFirstSync
            ? data && data.firstContactSync
            : data && data.syncContactUpdate
          loggerInfo(loggerId, { outlookContactSyncId })

          if (outlookContactSyncId) removeInProcessSync(outlookContactSyncId)

        } catch (err) {
          loggerError(loggerId + ' runReadyToSyncContact ERROR: ', {
            errMsg: err.message,
            err,
            outlookReadyContactSyncId
          })

          removeInProcessSync(outlookReadyContactSyncId)

          await OutlookContactSync.updateOne(
            { _id: outlookReadyContactSyncId },
            {
              started: false,
              finished: true,
              status: OutlookSyncStatusTypes.FAILED_SYNCING,
              errMessage: 'cron error: ' + err.message
            },
          )

        }
      }
    }
  } catch (e) {
    loggerError('runReadyToSyncContact ERROR: ', e.message)
  }
}


module.exports = {
  runReadyToSyncContact,
}
