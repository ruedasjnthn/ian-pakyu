
const { OutlookSync } = require('../Helper/OutlookSyncHelper')
const { clientGqlMutate } = require('../Helper/gqlClientHelper')
const { gql } = require('apollo-server-express')
const { OutlookSyncStatusTypes } = require('../constants/outlook')
const { loggerInfo, loggerError } = require('../config/logger')


let onSyncProcess = []

const removeInProcess = (syncId) => {
  const newOnSyncProcess = onSyncProcess.filter(id => id !== String(syncId))
  onSyncProcess = newOnSyncProcess
}

async function runReadyToSync() {
  try {
    const outlookReadySync = await OutlookSync.findOne(
      { status: OutlookSyncStatusTypes.READY_TO_SYNC },
      'projectId isFirstSync status'
    )

    const executeSync = outlookReadySync && !onSyncProcess.find(id => id === outlookReadySync.id)

    loggerInfo('------------------------------------------------------------');
    loggerInfo('--- ready to sync', { outlookReadySync, onSyncProcess });

    try {
      if (Boolean(executeSync)) {
        const outlookReadySyncId = outlookReadySync.id;
        loggerInfo('~~~~~~~~ CALLING SYNC .....', outlookReadySyncId)
        onSyncProcess.push(outlookReadySyncId)

        const mutationObject = outlookReadySync.isFirstSync
          ? {
            mutation: gql`
          mutation firstCalendarSync(
            $projectId: ID!,
            $outlookSyncId: ID!,
          ) {
            firstCalendarSync(
              projectId: $projectId,
              outlookSyncId: $outlookSyncId,
            )
          }
        `,
            variables: {
              "projectId": outlookReadySync.projectId,
              "outlookSyncId": outlookReadySyncId,
            },
          }
          : {
            mutation: gql`
          mutation syncCalendarUpdate(
            $projectId: ID!,
            $outlookSyncId: ID!,
          ) {
            syncCalendarUpdate(
              projectId: $projectId,
              outlookSyncId: $outlookSyncId,
            )
          }
        `,
            variables: {
              "projectId": outlookReadySync.projectId,
              "outlookSyncId": outlookReadySyncId,
            },
          }

        const { data, error } = await clientGqlMutate(mutationObject)
        loggerInfo('~~~~~~~~~ DONE SYNC.', outlookReadySyncId, { data, error })
        let outlookSyncId;

        outlookSyncId = outlookReadySync.isFirstSync
          ? data && data.firstCalendarSync
          : data && data.syncCalendarUpdate

        if (outlookSyncId) removeInProcess(outlookSyncId)

      }
    } catch (e) {
      if (outlookReadySync) {
        removeInProcess(outlookReadySync._id)
        await OutlookSync.updateOne(
          { _id: outlookReadySync._id },
          { status: OutlookSyncStatusTypes.FAILED_SYNCING },
        )
      }
      loggerError('ERROR: runReadyToSync,', { e })
    }
  } catch (err) {
    onSyncProcess = []
    loggerError('ERROR: runReadyToSync,', err.message)
  }
}

module.exports = {
  runReadyToSync,
}
