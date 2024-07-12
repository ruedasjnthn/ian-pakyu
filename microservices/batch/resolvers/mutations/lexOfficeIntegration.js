const mongoose = require('mongoose');
const { loggerInfo, loggerError } = require('../../config/logger');

const saveLexOfficeIntegration = async (_, { lexOfficeIntegrationInput }, { models }) => {
  loggerInfo(lexOfficeIntegrationInput);

  try {
    let data = {
      name: lexOfficeIntegrationInput.name,
      apiKey: lexOfficeIntegrationInput.apiKey,
      projectId: lexOfficeIntegrationInput.projectId,
      isEnabled: lexOfficeIntegrationInput.isEnabled
    };

    if (lexOfficeIntegrationInput.fieldMapping) {
      data.fieldMapping = lexOfficeIntegrationInput.fieldMapping;
    }
    if (lexOfficeIntegrationInput.lexOfficeIntegrationId) {
      await models.lexOfficeIntegration.findOneAndUpdate(
        { _id: lexOfficeIntegrationInput.lexOfficeIntegrationId },
        data,
      );
      return lexOfficeIntegrationInput.lexOfficeIntegrationId;
    } else {
      data.ContactIdIssueIdMapping = []
      var ts = await models.lexOfficeIntegration.create(data);
      return ts._id;
    }
  } catch (e) {
    loggerError({ e });
  }

  return '';
};

const deleteLexOfficeIntegration = async (_, { lexOfficeIntegrationId }, { models }) => {
  loggerInfo(lexOfficeIntegrationId);
  try {
    await models.lexOfficeIntegration.deleteOne({ _id: lexOfficeIntegrationId });
    return 'deleted';
  } catch (error) {
    loggerError({ error });
  }

  return '';
};

module.exports = {
  saveLexOfficeIntegration,
  deleteLexOfficeIntegration,
};
