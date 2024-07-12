const syncEvents = require('./sync-events')
const syncIssueEvents = require('./sync-issue-events')
const syncSeriesEvents = require('./sync-series-events')
const syncFinish = require('./sync-finish')
const updateSyncStatus = require('./sync-update-status')

module.exports = {
  ...syncEvents,
  ...syncIssueEvents,
  ...syncSeriesEvents,
  ...updateSyncStatus,
  ...updateSyncStatus,
  ...syncFinish,
}
