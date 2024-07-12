const mongoose = require('mongoose')
const { loggerInfo } = require('../../config/logger')

const dbHealth = async () => {
    const result = mongoose.connection.readyState
    loggerInfo('database health status: ', result)
    return result;
};

module.exports = {
  dbHealth,
};
