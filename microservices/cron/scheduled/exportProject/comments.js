const { clientGqlMutate } = require('../../Helper/gqlClientHelper')
const { ExportProjectJob } = require('../../models')
const { gql } = require("@apollo/client");
const { loggerInfo, loggerError } = require('../../config/logger');
const { ExportProjectJobStatusType } = require('../../constants/exportProjectJob');

let jobsIdsProcessing = []

const removeInProcess = (jobId) => {
  const newOnProcess = jobsIdsProcessing.filter(id => String(id) !== String(jobId))
  jobsIdsProcessing = newOnProcess
}

async function runExportProjectJobsComments() {
  try {
    loggerInfo('runExportProjectJobsComments', jobsIdsProcessing)

    // cron scehd is every 5 secs
    const jobLimitPerCronSched = 2

    const jobs = await ExportProjectJob
      .find(
        { status: ExportProjectJobStatusType.READY_TO_EXPORT_COMMENTS, },
        'projectId status'
      )
      .limit(jobLimitPerCronSched)

    loggerInfo({ jobs })
    jobsIdsProcessing = [...jobsIdsProcessing, ...jobs.map(job => job._id)]

    for (const job of jobs) {

      const mutationObject = {
        mutation: gql`
              mutation exportProjectComments(
                $projectId: ID!, 
                $exportProjectJobId: ID!
              ) {
                exportProjectComments(
                  projectId: $projectId
                  exportProjectJobId: $exportProjectJobId
                ) 
              } 
            `,
        variables: {
          "projectId": job.projectId,
          "exportProjectJobId": job._id,
        },
      }

      try {

        const { data } = await clientGqlMutate(mutationObject)
        loggerInfo({ mutationObject, data })
        if (data) removeInProcess(job._id)

      } catch (e) {

        removeInProcess(job._id)
        loggerError('exportProjectComments', { e })

      }
    }

    loggerInfo('jobs', jobs)



  } catch (e) {
    jobsIdsProcessing = []
    loggerError('runExportProjectJobsComments', { e })
  }
}

module.exports = {
  runExportProjectJobsComments
}
