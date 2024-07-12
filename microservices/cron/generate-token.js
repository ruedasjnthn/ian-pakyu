const { generateJWT } = require("./config/jwt")
const mongoose = require('mongoose');
const { loggerInfo, loggerError } = require('./config/logger')

const cronSecretUserId = String(mongoose.Types.ObjectId());

const cronJwtToken = generateJWT({ secretUserId: cronSecretUserId })

loggerInfo({ cronJwtToken, cronSecretUserId })
