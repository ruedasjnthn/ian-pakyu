const { clientGqlMutate } = require('../../Helper/gqlClientHelper')
const { gql } = require("@apollo/client");
const { loggerInfo, loggerError } = require('../../config/logger');

async function runUpdateExportProjectJobsStatus() {
  try {
    loggerInfo('runUpdateExportProjectJobsStatus')

    const mutationObject = {
      mutation: gql`
        mutation updateExportProjectJobStatus {
          updateExportProjectJobStatus
        } 
      `,
    }

    try {

      const { data } = await clientGqlMutate(mutationObject)
      loggerInfo({ mutationObject, data })

    } catch (e) {
      loggerError('updateExportProjectJobStatus', { e })
    }

  } catch (e) {
    loggerError('runUpdateExportProjectJobsStatus', { e })
  }
}

module.exports = {
  runUpdateExportProjectJobsStatus
}
