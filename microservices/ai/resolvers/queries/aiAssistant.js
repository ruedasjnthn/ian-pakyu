const { loggerInfo, loggerError } = require('../../config/logger')

const aiMenuItems = async (_, __, {models}) => {
  try {
    const menuItems = await models.AiAssistant.find();
    loggerInfo(menuItems)
    return menuItems;
  } catch (e) {
    loggerError({ e })
  }
};

module.exports = {
  aiMenuItems,
};
