const { loggerInfo, loggerError } = require('../../config/logger')
const { CalendarUpdateLog } = require('../../models')

const syncEventsInCalUpdLogs = async ({
  _ids,
  _projectId,
  _outlookSyncId,
  _eventIds,
  _action,
  _outlookIds
  // _customFielIds,
}) => {
  try {
    const updatedLogs = await CalendarUpdateLog.updateMany(
      {
        synced: false,
        projectId: _projectId,
        action: _action,
        ..._ids && { _id: { $in: _ids } },
        ..._outlookSyncId && { outlookSyncId: _outlookSyncId, },
        ..._eventIds && { eventId: { $in: _eventIds || [] }, },
        ..._outlookIds && { outlookId: { $in: _outlookIds || [] }, },
      },
      {
        synced: true,
      }
    )
    loggerInfo('updatedLogs', { updatedLogs })
  } catch (error) {
    loggerError('ERROR: syncEventsInCalUpdLogs,', { error })
    return error
  }
}

module.exports = {
  syncEventsInCalUpdLogs
}