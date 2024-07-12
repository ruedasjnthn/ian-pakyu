const { clientGqlMutate } = require('../../../Helper/gqlClientHelper')
const { gql } = require("@apollo/client");
const { loggerInfo, loggerError } = require('../../../config/logger');

async function runUpdateFirstOutlookSyncStatusJobs() {
  try {
    loggerInfo('runUpdateOutlookSyncStatus')

    const mutationObject = {
      mutation: gql`
        mutation updateFirstOutlookSyncStatus {
          updateFirstOutlookSyncStatus
        } 
      `,
    }

    try {

      const { data } = await clientGqlMutate(mutationObject)
      loggerInfo({ mutationObject, data })

    } catch (e) {
      loggerError('updateFirstOutlookSyncStatus cron', { e })
    }

  } catch (e) {
    loggerError('runUpdateFirstOutlookSyncStatusJobs', { e })
  }
}

module.exports = {
  runUpdateFirstOutlookSyncStatusJobs
}
