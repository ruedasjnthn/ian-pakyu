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
async function runSyncFinishOutlookFirstSyncJobs() {
  try {
    loggerInfo('runSyncFinishOutlookFirstSyncJobs', onSyncProcess)

    const outlookSync = await OutlookSync.findOne(
      {
        _id: { $nin: onSyncProcess },
        status: OutlookCalendarSyncStatus.READY_TO_FINISH_FIRST_SYNC
      },
      'projectId isFirstSync status cronRetryCount'
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
              mutation finishFirstOutlookSync(
                $projectId: ID!, 
                $outlookSyncId: ID!
              ) {
                finishFirstOutlookSync(
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

        let outlookSyncId = data && data.finishFirstOutlookSync

        if (outlookSyncId) removeInProcess(outlookSyncId)
      }

      // await handleCalendarSyncGqlSocketHangup({
      //   gqlRequest,
      //   onError,
      //   funcId: 'runSyncFinishOutlookFirstSyncJobs'
      // })

      const onEnd = async () => removeInProcess(outlookReadySyncId)

      await handleCalSyncOnError({
        gqlRequest,
        onEnd,
        retryCount: cronRetryCount,
        syncId: outlookReadySyncId,
        funcId: 'runSyncFinishOutlookFirstSyncJobs',
        errorStatus: OutlookCalendarSyncStatus.FAILED_TO_FINISH_FIRST_SYNC,
        retryStatus: OutlookCalendarSyncStatus.READY_TO_FINISH_FIRST_SYNC,
      })

    }

    // try {
    //   if (canExecuteSync) {
    //     const outlookReadySyncId = outlookSync.id;
    //     loggerInfo('~~~~~~~~ CALLING SYNC .....', outlookReadySyncId)
    //     onSyncProcess.push(outlookReadySyncId)

    //     const mutationObject = {
    //       mutation: gql`
    //             mutation finishFirstOutlookSync(
    //               $projectId: ID!, 
    //               $outlookSyncId: ID!
    //             ) {
    //               finishFirstOutlookSync(
    //                 projectId: $projectId
    //                 outlookSyncId: $outlookSyncId
    //               ) 
    //             } 
    //           `,
    //       variables: {
    //         "projectId": outlookSync.projectId,
    //         "outlookSyncId": outlookSync._id,
    //       },
    //     }

    //     const { data } = await clientGqlMutate(mutationObject)
    //     loggerInfo({ mutationObject, data })

    //     let outlookSyncId = data && data.finishFirstOutlookSync

    //     if (outlookSyncId) removeInProcess(outlookSyncId)

    //   }
    // } catch (e) {
    //   if (outlookSync) {
    //     removeInProcess(outlookSync._id)
    //     await OutlookSync.updateOne(
    //       { _id: outlookSync._id },
    //       { status: OutlookCalendarSyncStatus.FAILED_TO_FINISH_FIRST_SYNC },
    //     )
    //   }
    //   loggerError('ERROR: finishFirstOutlookSync,', { e })
    // }

  } catch (e) {
    onSyncProcess = []
    loggerError('runSyncFinishOutlookFirstSyncJobs', { e })
  }
}

module.exports = {
  runSyncFinishOutlookFirstSyncJobs
}
