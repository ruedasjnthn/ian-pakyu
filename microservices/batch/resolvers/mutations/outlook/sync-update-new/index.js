const deletedEvents = require('./delete-events')
const deleteHiddenIssueEvents = require('./delete-hidden-issue-events')
const deleteOutlookEvents = require('./delete-outlook-events')
const deleteOutlookIssueEvents = require('./delete-outlook-issue-events')
const syncDeletedEvents = require('./sync-deleted-events')
const syncEventCategories = require('./sync-event-categories')
const syncFinish = require('./sync-finish')
const syncNewEvents = require('./sync-new-events')
const syncNewIssueEvents = require('./sync-new-issue-events')
const syncOutlookEvents = require('./sync-outlook-events')
const syncUpdatedStatus = require('./sync-update-status')
const syncUpdatedEvents = require('./sync-updated-events')
const syncUpdatedIssueEvents = require('./sync-updated-issue-events')
const syncUpdatedSeriesEvents = require('./sync-updated-series-events')

module.exports = {
  ...deletedEvents,
  ...deleteHiddenIssueEvents,
  ...deleteOutlookEvents,
  ...deleteOutlookIssueEvents,
  ...syncDeletedEvents,
  ...syncEventCategories,
  ...syncFinish,
  ...syncNewEvents,
  ...syncNewIssueEvents,
  ...syncOutlookEvents,
  ...syncUpdatedStatus,
  ...syncUpdatedEvents,
  ...syncUpdatedIssueEvents,
  ...syncUpdatedSeriesEvents,
}
