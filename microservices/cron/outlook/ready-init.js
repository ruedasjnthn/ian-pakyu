
const { OutlookSync } = require('../Helper/OutlookSyncHelper')
const { clientGqlMutate } = require('../Helper/gqlClientHelper')
const { OutlookSyncStatusTypes } = require('../constants/outlook')
const { gql } = require('@apollo/client')
const { loggerInfo, loggerError } = require('../config/logger')
const { OutlookCalendarSyncStatus } = require('../constants/outlook-calendar')

let onInitProcess = []

const removeInProcess = (syncId) => {
  const newOnProcess = onInitProcess.filter(id => id !== syncId)
  onInitProcess = newOnProcess
}

async function runReadyToInitialize() {
  try {
    const outlookSync = await OutlookSync.findOne(
      { status: OutlookCalendarSyncStatus.READY_TO_INITIALIZE },
      'status projectId nextLink'
    )

    const executeInitialize = outlookSync && !onInitProcess.find(id => id === outlookSync.id)

    loggerInfo('------------------------------------------------------------');
    loggerInfo('--- ready to initialize', { onInitProcess, executeInitialize });

    try {

      if (Boolean(executeInitialize)) {
        const outlookSyncId = outlookSync.id;
        loggerInfo('~~~~~~~~ CALLING INIT .....', outlookSyncId)
        onInitProcess.push(outlookSyncId)

        const mutationObject = {
          mutation: gql`
          mutation initializeSyncForCron(
            $projectId: ID!,
            $outlookSyncId: ID!,
            $nextLink: String
          ) {
            initializeSyncForCron(
              projectId: $projectId,
              outlookSyncId: $outlookSyncId,
              nextLink: $nextLink,
            )
          }
        `,
          variables: {
            "projectId": outlookSync.projectId,
            "outlookSyncId": outlookSyncId,
            "nextLink": outlookSync.nextLink,
          },
        }

        const { data, errors } = await clientGqlMutate(mutationObject)
        loggerInfo('~~~~~~~~~ DONE INIT.', outlookSyncId, { data, errors })
        if (!errors && data.initializeSyncForCron) removeInProcess(data.initializeSyncForCron);

      }
    } catch (e) {
      if (outlookSync) {
        removeInProcess(outlookSync.id);
        await OutlookSync.updateOne(
          { _id: outlookSync._id },
          { status: OutlookSyncStatusTypes.FAILED_INITIALIZING },
        )
      }
      loggerError('ERROR: runReadyToInitialize,', { e })
    }

  } catch (e) {
    onInitProcess = []
    loggerError('ERROR: runReadyToInitialize,', { e })
  }
}

module.exports = {
  runReadyToInitialize,
}
