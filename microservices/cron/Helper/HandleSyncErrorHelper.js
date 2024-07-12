const { loggerError } = require("../config/logger")
const { OutlookSync } = require("./OutlookSyncHelper")

const RETRY_LIMIT = 3

const handleCalSyncOnError = async ({ gqlRequest, onEnd, funcId, syncId, retryStatus, errorStatus, retryCount }) => {
  try {

    await gqlRequest()

    await OutlookSync.updateOne(
      { _id: syncId },
      { cronRetryCount: 0, },
    )

  } catch (err) {

    if (onEnd) onEnd(err)

    const gqlErrors = err?.graphQLErrors || []
    const networkError = err?.networkError

    const retryLimitExceeded = retryCount > RETRY_LIMIT
    const shouldRetry = (gqlErrors.length > 0 || Boolean(networkError)) && !retryLimitExceeded

    loggerError('ERROR handleCalSyncOnError' + funcId || '', {
      gqlErrors,
      networkError,
      retryLimitExceeded,
      shouldRetry,
      syncId,
      err,
      retryCount
    })

    await OutlookSync.updateOne(
      { _id: syncId },
      {
        status: shouldRetry ? retryStatus : errorStatus,
        ...shouldRetry && { cronRetryCount: retryCount + 1 },
        failedAt: new Date(),
        cronErrMessage: err.message,
      },
    )

  }
}

module.exports = {
  handleCalSyncOnError
}