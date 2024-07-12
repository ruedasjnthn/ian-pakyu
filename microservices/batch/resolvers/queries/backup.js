const { loggerInfo, loggerError } = require('../../config/logger');

const projectBackupEnabled = async (_, { projectId }, { models, user }) => {
  try {
    const backupFound = await models.BackupEnabledProject.findOne(
      { projectId },
    )
    loggerInfo({ backupFound })
    return backupFound
  } catch (error) {
    loggerError({ error })
    return false
  }
}

module.exports = {
  projectBackupEnabled
}