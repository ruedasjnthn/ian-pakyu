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

async function runDuplicateProjectJobsComments() {
  try {
    loggerInfo('runDuplicateProjectJobsComments', jobsIdsProcessing)

    // cron scehd is every 5 secs
    const jobLimitPerCronSched = 2

    const jobs = await DuplicateProjectJob
      .find(
        { status: DuplicateProjectJobStatusType.READY_TO_DUPLICATE_COMMENTS, },
        'projectId status'
      )
      .limit(jobLimitPerCronSched)

    loggerInfo({ jobs })
    jobsIdsProcessing = [...jobsIdsProcessing, ...jobs.map(job => job._id)]

    for (const job of jobs) {

      const mutationObject = {
        mutation: gql`
              mutation duplicateProjectComments(
                $projectId: ID!, 
                $duplicateProjectJobId: ID!
              ) {
                duplicateProjectComments(
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
        loggerError('duplicateProjectComments', { e })

      }
    }

    loggerInfo('jobs', jobs)



  } catch (e) {
    jobsIdsProcessing = []
    loggerError('runDuplicateProjectJobsComments', { e })
  }
}

module.exports = {
  runDuplicateProjectJobsComments
}
