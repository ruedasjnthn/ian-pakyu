const { OutlookSync } = require('../../../Helper/OutlookSyncHelper')
const { clientGqlMutate } = require('../../../Helper/gqlClientHelper')

const { gql } = require("@apollo/client");
const { loggerInfo, loggerError } = require('../../../config/logger');
const { OutlookCalendarSyncStatus } = require('../../../constants/outlook-calendar');
const { handleCalSyncOnError } = require('../../../Helper/HandleSyncErrorHelper');

let onSyncProcess = []

const removeInProcess = (jobId) => {
  const newOnProcess = onSyncProcess.filter(id => String(id) !== String(jobId))
  onSyncProcess = newOnProcess
}

const getCanExecuteSync = outlookSync => Boolean(
  outlookSync &&
  !onSyncProcess.find(id => String(id) === String(outlookSync.id))
)


// run sync  events
async function runSyncDeleteSyncedEventsOutlookJobs() {
  try {
    loggerInfo('runSyncDeleteSyncedEventsOutlookJobs', onSyncProcess)

    const outlookSync = await OutlookSync.findOne(
      {
        _id: { $nin: onSyncProcess },
        status: OutlookCalendarSyncStatus.READY_TO_DELETE_EVENTS
      },
      'projectId status'
    ).sort('-updatedAt')

    const canExecuteSync = getCanExecuteSync(outlookSync)

    loggerInfo({ outlookSync, canExecuteSync })

    if (canExecuteSync) {

      const outlookReadySyncId = outlookSync.id;
      const cronRetryCount = outlookSync.cronRetryCount;

      const gqlRequest = async () => {

        loggerInfo('~~~~~~~~ CALLING SYNC .....', outlookReadySyncId)
        onSyncProcess.push(outlookReadySyncId)

        const mutationObject = {
          mutation: gql`
                mutation deleteSyncedEvents(
                  $projectId: ID!, 
                  $outlookSyncId: ID!
                ) {
                  deleteSyncedEvents(
                    projectId: $projectId
                    outlookSyncId: $outlookSyncId
                  ) 
                } 
              `,
          variables: {
            "projectId": outlookSync.projectId,
            "outlookSyncId": outlookSync._id,
          },
        }

        const { data } = await clientGqlMutate(mutationObject)
        loggerInfo({ mutationObject, data })

        let outlookSyncId = data && data.deleteSyncedEvents

        if (outlookSyncId) removeInProcess(outlookSyncId)
      }

      // const onError = async (err) => {
      //   if (outlookSync) {
      //     removeInProcess(outlookSync._id)
      //     await OutlookSync.updateOne(
      //       { _id: outlookSync._id },
      //       {
      //         status: OutlookCalendarSyncStatus.FAILED_TO_DELETE_EVENTS,
      //         failedAt: new Date(),
      //         cronErrMessage: err.message,
      //       },
      //     )
      //   }
      // }

      // await handleCalendarSyncGqlSocketHangup({
      //   gqlRequest,
      //   onError,
      //   funcId: 'runSyncDeleteSyncedEventsOutlookJobs'
      // })

      const onEnd = async () => removeInProcess(outlookReadySyncId)

      await handleCalSyncOnError({
        gqlRequest,
        onEnd,
        retryCount: cronRetryCount,
        syncId: outlookReadySyncId,
        funcId: 'runSyncDeleteSyncedEventsOutlookJobs',
        errorStatus: OutlookCalendarSyncStatus.FAILED_TO_DELETE_EVENTS,
        retryStatus: OutlookCalendarSyncStatus.READY_TO_DELETE_EVENTS,
      })
      
    }
   

  } catch (e) {
    onSyncProcess = []
    loggerError('runSyncDeleteSyncedEventsOutlookJobs', { e })
  }
}

module.exports = {
  runSyncDeleteSyncedEventsOutlookJobs
}
