const { getRefreshToken } = require('../../../helper/AuthHelper');

const syncToggle = require('./sync-toggle')
const syncFirstNew = require('./sync-first-new')
const syncUpdateNew = require('./sync-update-new')
const syncCommon = require('./common')
const initSync = require('./init-new')

const { initializeSyncForCron } = require('./sync-init')
const { firstCalendarSync } = require('./sync-first')
const { syncCalendarUpdate } = require('./sync-update')
const { readyToInitializeSync } = require('./ready-init')
const { saveOutlookAccessToken } = require('./save-token')
const { updateProjectCalendarId } = require('./update-calendar-id')

const refreshToken = async (_, { projectId }, { models, user }) => {
  await getRefreshToken()
  return ''
}

module.exports = {
  ...syncToggle,

  ...syncFirstNew,
  ...syncUpdateNew,

  ...syncCommon,
  ...initSync,

  saveOutlookAccessToken,
  updateProjectCalendarId,
  readyToInitializeSync,
  refreshToken,

  initializeSyncForCron,
  firstCalendarSync,
  syncCalendarUpdate
}
