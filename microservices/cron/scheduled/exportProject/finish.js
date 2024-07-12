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

async function runFinishExportProjectJobs() {
  try {
    loggerInfo('runFinishExportProjectJobs', jobsIdsProcessing)

    // cron scehd is every 5 secs
    const jobLimitPerCronSched = 2

    const jobs = await ExportProjectJob
      .find(
        { status: ExportProjectJobStatusType.READY_TO_FINISH_EXPORT_PROJECT, },
        'projectId status'
      )
      .limit(jobLimitPerCronSched)

    loggerInfo({ jobs })
    jobsIdsProcessing = [...jobsIdsProcessing, ...jobs.map(job => job._id)]

    for (const job of jobs) {

      const mutationObject = {
        mutation: gql`
              mutation finishExportProject(
                $projectId: ID!, 
                $exportProjectJobId: ID!
              ) {
                finishExportProject(
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
        loggerError('finishExportProject', { e })

      }
    }

    loggerInfo('jobs', jobs)



  } catch (e) {
    jobsIdsProcessing = []
    loggerError('runFinishExportProjectJobs', { e })
  }
}

module.exports = {
  runFinishExportProjectJobs
}
