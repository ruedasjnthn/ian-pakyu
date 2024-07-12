const { ApolloError } = require("apollo-server");
const jwt = require("jsonwebtoken");
const moment = require('moment');
const { getEmailRegex } = require("../../helper/EmailHelper");

const currentUser = async (_, __, { user, models }) => {
  try {
    const loggedUser = await models.User.findOne({ _id: user.sub }).exec();
    return ({
      id: loggedUser._id,
      name: loggedUser.name,
      email: loggedUser.Email,
      avatarUrl: loggedUser.avatarUrl,
      avatarFileId: loggedUser.avatarFileId,
      languageCode: loggedUser.languageCode,
      avatarColor: loggedUser.avatarColor,
      changeEmail: loggedUser.changeEmail && loggedUser.changeEmail.newEmail,
      countAllOpenTasks: loggedUser.countAllOpenTasks,
      disableAutoRefresh: loggedUser.disableAutoRefresh,
      weeklyHour: loggedUser.weeklyHour,
      workingDays: loggedUser.workingDays,
      descriptionTemplate: loggedUser.descriptionTemplate,
      countOnlyWeeklyHours: loggedUser.countOnlyWeeklyHours
    })
  } catch (e) {
    return e
  }
}

const verifyToken = async (_, { token }, { models }) => {

  try {
    const jwtData = jwt.verify(
      token,
      process.env.JwtToken,
      (err, verifiedJwt) => {
        if (err) {
          return false;
        } else {
          return verifiedJwt;
        }
      }
    )

    const userFound = await models.User.findById(jwtData.sub, 'Hash');

    const jwtDataObject = jwtData['https://backend.aktenplatz.de/graphql'];
    const jwtDataHash = jwtDataObject && jwtDataObject.Hash;

    if (userFound && jwtData && jwtDataHash && userFound.Hash === jwtDataHash) {
      return true
    } else throw new ApolloError('unauthorized')
  } catch (e) { return (e) }

}

const userInfo = async (_, { id }, { models }) => {
  try {
    const loggedUser = await models.User.findOne({ _id: id }).exec();
    return ({
      id: loggedUser._id,
      name: loggedUser.name,
      email: loggedUser.Email,
      avatarUrl: loggedUser.avatarUrl,
      avatarColor: loggedUser.avatarColor,
      avatarFileId: loggedUser.avatarFileId,
      languageCode: loggedUser.languageCode,
    })
  } catch (e) {
    return e
  }
}

const userLoginBlocked = async (_, { email }, { models, userIpPassedByGateway }) => {
  try {
    const userFound = await models.User.findOne(
      { Email: { $regex: getEmailRegex(email) } },
      'otpFails Email'
    );

    let latestFailTime;
    let loginBlocked = false;
    let isAccountLocked = false;

    if (userFound && email.length === userFound.Email.length) {
      const otpFails = (userFound.otpFails || []).filter(x => x.userIp == userIpPassedByGateway);
      const otpFailsLength = otpFails.length

      isAccountLocked = otpFailsLength > 4

      if (otpFailsLength >= 3) {

        const latestFailTime = otpFails[otpFailsLength - 1].failedAt
        let tryMintue = Math.floor(Math.pow(2, otpFailsLength - 1));
        let canRetyAfterDate = moment(latestFailTime).add(tryMintue, 'm').toDate();

        loginBlocked = otpFailsLength >= 3 &&
          moment().diff(canRetyAfterDate, 'seconds') <= 0
      }
    }

    return {
      latestFailTime,
      isAccountLocked,
      loginBlocked,
    }
  } catch (e) {
    return e
  }
}
const getTimeTrackerStatus = async (_, __, { user, models }) => {
  try {
    const loggedUser = await models.User.findOne({ _id: user.sub }).exec();
    const timeTrackerStatusUpdateAt = loggedUser.timeTrackerStatusUpdateAt
    return {
      timeTrackerStatus: loggedUser.timeTrackerStatus,
      timeTrackerStatusUpdateAt: timeTrackerStatusUpdateAt
        && new Date(timeTrackerStatusUpdateAt).toISOString()
    }
  } catch (e) {
    return e
  }
}

module.exports = {
  currentUser,
  verifyToken,
  userInfo,
  userLoginBlocked,
  getTimeTrackerStatus
}