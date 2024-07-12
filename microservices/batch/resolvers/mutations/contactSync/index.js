const { getRefreshToken } = require('../../../helper/AuthHelper');
const { initializeContactSyncForCron } = require('./sync-init')
const { firstContactSync } = require('./sync-first')
const { syncContactUpdate } = require('./sync-update')
const { readyToInitializeContactSync } = require('./ready-init')
const { updateProjectContactId } = require('./update-contact-id')

const refreshToken = async (_, { projectId }, { models, user }) => {
  await getRefreshToken()
  return ''
}

module.exports = {
  refreshToken,
  updateProjectContactId,
  readyToInitializeContactSync,
  initializeContactSyncForCron,
  firstContactSync,
  syncContactUpdate,
}
  