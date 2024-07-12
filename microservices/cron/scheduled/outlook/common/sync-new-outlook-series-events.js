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
async function runSyncNewOutlookSeriesEventsOutlookJobs() {
  try {
    loggerInfo('runSyncNewOutlookSeriesEventsOutlookJobs', onSyncProcess)

    const outlookSync = await OutlookSync.findOne(
      {
        _id: { $nin: onSyncProcess },
        status: OutlookCalendarSyncStatus.READY_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS
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
        onSyncProcess.push(outlookReadySyncId)

        const mutationObject = {
          mutation: gql`
                mutation syncNewOutlookSeriesEvents(
                  $projectId: ID!, 
                  $outlookSyncId: ID!
                ) {
                  syncNewOutlookSeriesEvents(
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

        let outlookSyncId = data && data.syncNewOutlookSeriesEvents

        if (outlookSyncId) removeInProcess(outlookSyncId)

      }

      const onEnd = async () => removeInProcess(outlookReadySyncId)

      await handleCalSyncOnError({
        gqlRequest,
        onEnd,
        retryCount: cronRetryCount,
        syncId: outlookReadySyncId,
        funcId: 'runSyncNewOutlookSeriesEventsOutlookJobs',
        errorStatus: OutlookCalendarSyncStatus.FAILED_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS,
        retryStatus: OutlookCalendarSyncStatus.READY_TO_SYNC_NEW_OUTLOOK_SERIES_EVENTS,
      })
    }

  } catch (e) {
    onSyncProcess = []
    loggerError('runSyncNewOutlookSeriesEventsOutlookJobs', { e })
  }
}

module.exports = {
  runSyncNewOutlookSeriesEventsOutlookJobs
}
