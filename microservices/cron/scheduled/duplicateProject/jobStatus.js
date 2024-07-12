const { clientGqlMutate } = require('../../Helper/gqlClientHelper')
const { gql } = require("@apollo/client");
const { loggerInfo, loggerError } = require('../../config/logger');

async function runUpdateDuplicateProjectJobsStatus() {
  try {
    loggerInfo('runUpdateDuplicateProjectJobsStatus')

    const mutationObject = {
      mutation: gql`
        mutation updateDuplicateProjectJobStatus {
          updateDuplicateProjectJobStatus
        } 
      `,
    }

    try {

      const { data } = await clientGqlMutate(mutationObject)
      loggerInfo({ mutationObject, data })

    } catch (e) {
      loggerError('updateDuplicateProjectJobStatus', { e })
    }

  } catch (e) {
    loggerError('runUpdateDuplicateProjectJobsStatus', { e })
  }
}

module.exports = {
  runUpdateDuplicateProjectJobsStatus
}
