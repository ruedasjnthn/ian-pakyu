const { clientGqlMutate } = require('../Helper/gqlClientHelper')
const { AutomationJob } = require('../Helper/AutomationJobHelper')
const { AutomationJobStatusTypes } = require('../constants/automation')
const { gql } = require("@apollo/client");
const moment = require('moment')
const { loggerInfo, loggerError } = require('../config/logger')

const limit = 5
let isProcessing = false

const executeAutomation = async (jobId, mutationObject) => {
  try {
    const { data } = await clientGqlMutate(mutationObject)

    loggerInfo('executed: executeAutomation | graphql_execute_automation')

    if (data) {
      loggerInfo('SUCCESS graphql_execute_automation', { data })
      await AutomationJob.updateOne(
        { _id: jobId, },
        { status: AutomationJobStatusTypes.SUCCESS }
      )
    }

  } catch (e) {
    loggerError('ERR!! graphql_execute_automation', { e })
    await AutomationJob.updateOne(
      { _id: jobId, },
      { status: AutomationJobStatusTypes.FAILED }
    )
  }
}

const runAutomationJobs = async () => {
  const start = new Date()
  isProcessing = true

  const jobs = await AutomationJob.find(
    {
      status: AutomationJobStatusTypes.PENDING,
      $or: [
        { timeToExecute: { $lte: moment().toISOString() } },
        { isInstant: true }
      ]
    },
    'id'
  ).limit(limit)

  for (const job of jobs) {
    const jobId = job._id
    const mutationObject = {
      mutation: gql`
        mutation executeAutomation($automationJobId: ID!) {
          executeAutomation(automationJobId: $automationJobId) 
        }  
      `,
      variables: { "automationJobId": jobId },
    }

    await executeAutomation(job, mutationObject)
  }

  loggerInfo('runAutomationJobs', { jobs })

  isProcessing = false
  const end = new Date()

  loggerInfo('runAutomationJobs', {
    lte: moment().toISOString(),
    'newDate': new Date(),
    start,
    end,
    time: (end - start) / 100
  })

}

async function runAutomationJobsWithTryCatch() {
  try {
    loggerInfo('runAutomationJobsWithTryCatch', isProcessing)
    if (!isProcessing) await runAutomationJobs()
  } catch (e) {
    isProcessing = false
    loggerError('runAutomationJobsWithTryCatch ERROR:', { e })
  }
}

module.exports = {
  runAutomationJobs: runAutomationJobsWithTryCatch
}
