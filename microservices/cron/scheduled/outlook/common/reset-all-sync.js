const { clientGqlMutate } = require('../../../Helper/gqlClientHelper')

const { gql } = require("@apollo/client");
const { loggerInfo, loggerError } = require('../../../config/logger');

async function runResetAllOutlookSyncJobs() {
  try {
    loggerInfo('runResetAllOutlookSyncJobs')

    const mutationObject = {
      mutation: gql`
        mutation resetAllOutlookSyncStatus {
          resetAllOutlookSyncStatus
        }
      `,
    }

    const { data } = await clientGqlMutate(mutationObject)
    loggerInfo({ mutationObject, data })

  } catch (e) {
    loggerError('runResetAllOutlookSyncJobs', { e })
  }
}

module.exports = {
  runResetAllOutlookSyncJobs
}
