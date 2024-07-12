const MailJobStatus = {
  PENDING: 'pending',
  EXECUTING: 'executing',
  SUCCESS: 'success',
  FAILED: 'failed',
  ERROR: 'error',
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
