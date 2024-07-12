
const { MailJob } = require('../models')
const { clientGqlMutate } = require('../Helper/gqlClientHelper')
const { gql } = require('apollo-server-express')
const { MailJobStatus } = require('../constants/mailJob')
const { loggerInfo, loggerError, loggerLocal } = require('../config/logger')
const moment = require('moment')

let executingJobs = []

const removeInExecuting = (mailJobId) => {
  const newExecutingJobs = executingJobs.filter(id => id !== String(mailJobId))
  executingJobs = newExecutingJobs
}

async function runMailJobs() {
  try {
    const pendingMailJobs = await MailJob.find(
      { status: { $in: [MailJobStatus.PENDING, MailJobStatus.FAILED] } },
      'id'
    ).sort('_id').limit(10)

    const pendingMailJobsIds = pendingMailJobs.map(mj => mj.id)

    const mailJobsToExecute = pendingMailJobs.filter(mj =>
      !executingJobs.find(mjid => String(mjid) === String(mj.id)))

    loggerInfo('runMailJobs', { executingJobs, pendingMailJobsIds, mailJobsToExecute })

    executingJobs = [...executingJobs, ...pendingMailJobsIds]

    for (const mailJob of mailJobsToExecute) {

      const mailJobId = mailJob.id

      let startTime = moment()
      loggerLocal('------------------------------------------------------------');
      loggerInfo('---ready to execute mail job', {
        mailJobId,
      });

      try {
        loggerInfo('~~~~~~~~ CALLING executeMailJob  .....', mailJobId)

        const mutationObject = {
          mutation: gql`
            mutation executeMailJob($mailJobId: ID!) {
              executeMailJob(mailJobId: $mailJobId)
            }
          `,
          variables: { "mailJobId": mailJobId },
        }

        const { data, error } = await clientGqlMutate(mutationObject)

        let endTime = moment()
        loggerInfo('~~~~~~~~~ DONE executeMailJob.', {
          mailJobId, data, error,
          startTime, endTime,
          timeDiff: moment(startTime).diff(endTime, 'seconds')
        })

        if (data || error) {
          removeInExecuting(mailJobId)
        }

      } catch (err) {
        loggerError('runMailJobs,', err.message)

        removeInExecuting(mailJobId)

        await MailJob.updateOne(
          { _id: mailJobId },
          {
            status: MailJobStatus.ERROR,
            errorMessage: err.message
          },
        )

      }

    }

  } catch (err) {
    executingJobs = []
    loggerError('runMailJobs', err.message)
    return err
  }
}

module.exports = {
  runMailJobs,
}
