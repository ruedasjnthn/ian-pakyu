const { OutlookSync } = require('../../../Helper/OutlookSyncHelper')
const { clientGqlMutate } = require('../../../Helper/gqlClientHelper')

const { gql } = require("@apollo/client");
const { loggerInfo, loggerError } = require('../../../config/logger');
const { OutlookCalendarSyncStatus } = require('../../../constants/outlook-calendar');
const { handleCalSyncOnError } = require('../../../Helper/HandleSyncErrorHelper');

let onInitProcess = []

const removeInProcess = (jobId) => {
  const newOnProcess = onInitProcess.filter(id => String(id) !== String(jobId))
  onInitProcess = newOnProcess
}

const getCanExecuteSync = outlookSync => Boolean(
  outlookSync &&
  !onInitProcess.find(id => String(id) === String(outlookSync.id))
)


async function runSyncInitializeOutlookJobs() {
  try {
    loggerInfo('runSyncInitializeOutlookJobs', onInitProcess)

    const outlookSync = await OutlookSync.findOne(
      {
        _id: { $nin: onInitProcess },
        status: OutlookCalendarSyncStatus.READY_TO_INITIALIZE
      },
      'projectId status cronRetryCount'
    ).sort('-updatedAt')

    const canExecuteSync = getCanExecuteSync(outlookSync)

    loggerInfo({ outlookSync, canExecuteSync })


    if (canExecuteSync) {

      const outlookReadySyncId = outlookSync.id;
      const cronRetryCount = outlookSync.cronRetryCount;

      const gqlRequest = async () => {

        loggerInfo('~~~~~~~~ CALLING SYNC .....', outlookReadySyncId)
        onInitProcess.push(outlookReadySyncId)

        const mutationObject = {
          mutation: gql`
              mutation initializeSync(
                $projectId: ID!, 
                $outlookSyncId: ID!
              ) {
                initializeSync(
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

        let outlookSyncId = data && data.initializeSync

        if (outlookSyncId) removeInProcess(outlookSyncId)

      }

      // const onError = async (err) => {
      //   if (outlookSync) {
      //     removeInProcess(outlookSync._id)
      //     await OutlookSync.updateOne(
      //       { _id: outlookSync._id },
      //       {
      //         status: OutlookCalendarSyncStatus.FAILED_INITIALIZING,
      //         failedAt: new Date(),
      //         cronErrMessage: err.message,
      //       },
      //     )
      //   }
      // }

      // await handleCalendarSyncGqlSocketHangup({
      //   gqlRequest,
      //   onError,
      //   funcId: 'runSyncInitializeOutlookJobs'
      // })

      const onEnd = async () => removeInProcess(outlookReadySyncId)

      await handleCalSyncOnError({
        gqlRequest,
        onEnd,
        retryCount: cronRetryCount,
        syncId: outlookReadySyncId,
        funcId: 'runSyncInitializeOutlookJobs',
        errorStatus: OutlookCalendarSyncStatus.FAILED_INITIALIZING,
        retryStatus: OutlookCalendarSyncStatus.READY_TO_INITIALIZE,
      })

    }

  } catch (e) {
    onInitProcess = []
    loggerError('runSyncNewOutlookSeriesEventsOutlookJobs', { e })
  }
}

module.exports = {
  runSyncInitializeOutlookJobs
}
