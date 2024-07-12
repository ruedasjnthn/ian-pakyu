const { loggerInfo, loggerError } = require('../../config/logger');

const triggerBackupProject = async (_, { projectId }, { models, user }) => {
  try {
    const existingBackupQueue = await models.BackupEnabledProject.findOne(
      { projectId },
      {
        isBackedUp: false,
      }
    )

    if(existingBackupQueue) {
      return 'Project is already in queue waiting to backup'
    } else {
      await models.BackupEnabledProject.create({
        projectId,
        isEnabled: true,
        backupDate: new Date(),
      })
      loggerInfo('Queueing project to backup')
      return true
    }
  } catch (error) {
    loggerError({ error })
    return false
  }
}

module.exports = {
  triggerBackupProject,
}