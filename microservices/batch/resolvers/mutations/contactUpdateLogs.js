const { loggerInfo, loggerError } = require('../../config/logger')
const { ContactUpdateLog } = require('../../models')

const syncContactsInCalUpdLogs = async ({
  _projectId,
  _outlookContactSyncId,
  _contactIds,
  _action,
  // _customFielIds,
}) => {
  try {
    const updatedLogs = await ContactUpdateLog.updateMany(
      {
        projectId: _projectId,
        action: _action,
        ..._outlookContactSyncId && { outlookContactSyncId: _outlookContactSyncId, },
        ..._contactIds && { contactId: { $in: _contactIds || [] }, },
        synced: false,
      },
      {
        synced: true,
      }
    )
    loggerInfo('updatedLogs', { updatedLogs })
    // if (updatedLogs.modifiedCount) {

    // }
  } catch (error) {
    loggerError('ERROR: syncContactsInCalUpdLogs,', { error })
    return error
  }
}

module.exports = {
  syncContactsInCalUpdLogs
}