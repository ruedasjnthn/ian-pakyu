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

async function runExportProjectJobsCustomFields() {
  try {
    loggerInfo('runExportProjectJobsCustomFields', jobsIdsProcessing)

    // cron scehd is every 5 secs
    const jobLimitPerCronSched = 2

    const jobs = await ExportProjectJob
      .find(
        { status: ExportProjectJobStatusType.READY_TO_EXPORT_CUSTOM_FIELDS, },
        'projectId status'
      )
      .limit(jobLimitPerCronSched)

    loggerInfo({ jobs })
    jobsIdsProcessing = [...jobsIdsProcessing, ...jobs.map(job => job._id)]

    for (const job of jobs) {

      const mutationObject = {
        mutation: gql`
              mutation exportProjectCustomFields(
                $projectId: ID!, 
                $exportProjectJobId: ID!
              ) {
                exportProjectCustomFields(
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
        loggerError('exportProjectCustomFields', { e })

      }
    }

    loggerInfo('jobs', jobs)



  } catch (e) {
    jobsIdsProcessing = []
    loggerError('runExportProjectJobsCustomFields', { e })
  }
}

module.exports = {
  runExportProjectJobsCustomFields
}
