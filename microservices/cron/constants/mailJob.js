const MailJobStatus = {
  PENDING: 'dev_pending',
  EXECUTING: 'dev_executing',
  SUCCESS: 'dev_success',
  FAILED: 'dev_failed',
  ERROR: 'dev_error',
};

const MailJobStatusArray = [
  MailJobStatus.PENDING,
  MailJobStatus.EXECUTING,
  MailJobStatus.SUCCESS,
  MailJobStatus.FAILED,
  MailJobStatus.ERROR,
]

module.exports = {
  MailJobStatus,
  MailJobStatusArray
}
