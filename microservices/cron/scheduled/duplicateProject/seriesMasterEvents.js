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

async function runDuplicateProjectJobsSeriesMasterEvents() {
  try {
    loggerInfo('runDuplicateProjectJobsSeriesMasterEvents', jobsIdsProcessing)

    // cron scehd is every 5 secs
    const jobLimitPerCronSched = 2

    const jobs = await DuplicateProjectJob
      .find(
        { status: DuplicateProjectJobStatusType.READY_TO_DUPLICATE_SERIES_MASTER_EVENTS, },
        'projectId status'
      )
      .limit(jobLimitPerCronSched)

    loggerInfo({ jobs })
    jobsIdsProcessing = [...jobsIdsProcessing, ...jobs.map(job => job._id)]

    for (const job of jobs) {

      const mutationObject = {
        mutation: gql`
              mutation duplicateProjectSeriesMasterEvents(
                $projectId: ID!, 
                $duplicateProjectJobId: ID!
              ) {
                duplicateProjectSeriesMasterEvents(
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
        loggerError('duplicateProjectSeriesMasterEvents', { e })

      }
    }

    loggerInfo('jobs', jobs)



  } catch (e) {
    jobsIdsProcessing = []
    loggerError('runDuplicateProjectJobsSeriesMasterEvents', { e })
  }
}

module.exports = {
  runDuplicateProjectJobsSeriesMasterEvents
}
