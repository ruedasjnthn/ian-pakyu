const { clientGqlMutate } = require('../../../Helper/gqlClientHelper')
const { gql } = require("@apollo/client");
const { loggerInfo, loggerError } = require('../../../config/logger');

async function runUpdateInitOutlookSyncStatusJobs() {
  try {
    loggerInfo('runUpdateInitOutlookSyncStatusJobs')

    const mutationObject = {
      mutation: gql`
        mutation updateInitOutlookSyncStatus {
          updateInitOutlookSyncStatus
        } 
      `,
    }

    const { data } = await clientGqlMutate(mutationObject)
    loggerInfo({ mutationObject, data })

  } catch (e) {
    loggerError('runUpdateInitOutlookSyncStatusJobs', { e })
  }
}

module.exports = {
  runUpdateInitOutlookSyncStatusJobs
}
