const { clientGqlMutate } = require('../../Helper/gqlClientHelper')
const { DuplicateProjectJob } = require('../../models')
const { gql } = require("@apollo/client");
const { loggerInfo, loggerError } = require('../../config/logger');
const { DuplicateProjectJobStatusType } = require('../../constants/duplicateProjectJob');

let jobsIdsProcessing = []

const removeInProcess = (jobId) => {
  const newOnProcess = jobsIdsProcessing.filter(id => id !== jobId)
  jobsIdsProcessing = newOnProcess
}

async function runDuplicateProjectJobsPrefixes() {
  try {
    loggerInfo('runDuplicateProjectJobsPrefixes', jobsIdsProcessing)

    // cron scehd is every 5 secs
    const jobLimitPerCronSched = 2

    const jobs = await DuplicateProjectJob
      .find(
        { status: DuplicateProjectJobStatusType.READY_TO_DUPLICATE_PROJECT_PREFIXES, },
        'projectId status'
      )
      .limit(jobLimitPerCronSched)

    loggerInfo({ jobs })
    jobsIdsProcessing = [...jobsIdsProcessing, ...jobs.map(job => job._id)]

    for (const job of jobs) {

      const mutationObject = {
        mutation: gql`
              mutation duplicateProjectPrefixes(
                $projectId: ID!, 
                $duplicateProjectJobId: ID!
              ) {
                duplicateProjectPrefixes(
                  projectId: $projectId
                  duplicateProjectJobId: $duplicateProjectJobId
                ) 
              } 
            `,
        variables: {
          "projectId": job.projectId,
          "duplicateProjectJobId": job._id,
        },
      }

      try {

        const { data } = await clientGqlMutate(mutationObject)
        loggerInfo({ mutationObject, data })
        if (data) removeInProcess(job._id)

      } catch (e) {

        removeInProcess(job._id)
        loggerError('duplicateProjectPrefixes', { e })

      }
    }

    loggerInfo('jobs', jobs)



  } catch (e) {
    jobsIdsProcessing = []
    loggerError('runDuplicateProjectJobsPrefixes', { e })
  }
}

module.exports = {
  runDuplicateProjectJobsPrefixes
}
