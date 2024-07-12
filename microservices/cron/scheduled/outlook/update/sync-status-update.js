const { clientGqlMutate } = require('../../../Helper/gqlClientHelper')
const { gql } = require("@apollo/client");
const { loggerInfo, loggerError } = require('../../../config/logger');

async function runUpdateOutlookSyncStatusJobs() {
  try {
    loggerInfo('runUpdateOutlookSyncStatus')

    const mutationObject = {
      mutation: gql`
        mutation updateOutlookSyncStatus {
          updateOutlookSyncStatus
        } 
      `,
    }

    try {

      const { data } = await clientGqlMutate(mutationObject)
      loggerInfo({ mutationObject, data })

    } catch (e) {
      loggerError('updateOutlookSyncStatus cron', { e })
    }

  } catch (e) {
    loggerError('runUpdateOutlookSyncStatusJobs', { e })
  }
}

module.exports = {
  runUpdateOutlookSyncStatusJobs
}
