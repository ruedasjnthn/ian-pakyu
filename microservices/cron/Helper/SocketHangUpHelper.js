const { loggerError } = require("../config/logger")

const handleCalendarSyncGqlSocketHangup = async ({ gqlRequest, onError, funcId }) => {
  try {

    await gqlRequest()

  } catch (err) {

    const gqlErrors = err?.graphQLErrors || []
    const hasSocketHangupError = !!gqlErrors.find(err => err?.message?.includes('reason: socket hang up'))
    loggerError('ERROR: handleCalendarSyncGqlSocketHangup ' + (funcId || ''), {
      gqlErrors,
      hasSocketHangupError,
      err
    })
    if (hasSocketHangupError) await gqlRequest()
    else await onError(err)
  }
}

module.exports = {
  handleCalendarSyncGqlSocketHangup
}