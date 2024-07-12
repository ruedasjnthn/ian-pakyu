const crypto = require('crypto');
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { loginToken } = require("../../helper/loginHelper")
const { sendLoginMail, sendNewAccountMail, sendUpdateAccountMail } = require("../../helper/mailTemplateHelper");
const { ApolloError } = require('apollo-server');
const { addListMember } = require("../../helper/mailChimpHelper")
const { client_gql_mutate } = require('../../helper/gqlClientHelper')
const gql = require("graphql-tag");
const moment = require('moment')
const { log } = require("../../helper/LoggerHelper");
const { emailPattern, getEmailRegex } = require('../../helper/EmailHelper');
const { loggerInfo, loggerError, loggerLocal } = require('../../config/logger');

const mailLogin = async (_, { email, acceptInvite }, { models, userIpPassedByGateway, userAgent }) => {
  try {

    loggerLocal('-------------------- mailLogin --------------------------------');
    loggerInfo('mailLogin', { timeStamp: new Date().toString(), userIpPassedByGateway: userIpPassedByGateway, userAgent })

    if (!emailPattern.test(email)) throw new ApolloError('invalid_email')

    const regex = getEmailRegex(email)
    loggerInfo({ regex })

    const userFound = await models.User.findOne(
      { Email: { $regex: regex } },
      'Email Permissions Roles languageCode otpFails lastSentLoginTokenAt loginDetail'
    ).exec();

    const userExist = !!userFound && email.length === userFound.Email.length

    if (!userExist) throw new ApolloError('user_not_found')

    // check last sent  login token time
    // const lastSentLoginTokenAt = userFound.lastSentLoginTokenAt
    // const lastSentLoginTokenDiff = moment().diff(new Date(lastSentLoginTokenAt), 'seconds')
    // loggerInfo('mailLogin', { lastSentLoginTokenAt, lastSentLoginTokenDiff, email, acceptInvite },)

    // if (lastSentLoginTokenAt && lastSentLoginTokenDiff <= 10) {
    //   loggerInfo('!(EMAIL FAILED TO SEND)', { acceptInvite, email })
    //   throw new ApolloError('wait_for_ten_seconds_to_get_new_code')
    // }

    // // check if blocked
    const otpFails = (userFound.otpFails || []).filter(x => x.userIp == userIpPassedByGateway)
    if (otpFails.length > 0) {
      let otpRetryCount = otpFails.length
      const latestFailTime = otpFails[otpFails.length - 1].failedAt
      let otpTryMintue = Math.floor(Math.pow(2, otpRetryCount - 3));
      let canRetyAfterDate = moment(latestFailTime).add(otpTryMintue, 'm').toDate();

      if (moment().diff(canRetyAfterDate, 'seconds') <= 0) {
        throw new ApolloError('wait_for_minute_to_get_new_code', undefined, { tryMintue: otpTryMintue })
      }
    }

    let isFirstLogin = false;
    // if (userFound && userFound.loginDetail && userFound.lastSentLoginTokenAt) {
    //   if (userFound.loginDetail.userIp == userIpPassedByGateway) {
    //     let retryCount = userFound.loginDetail.retryCount || 0
    //     let tryMintue = Math.floor(Math.pow(2, retryCount - 1));
    //     let canRetyAfterDate = moment(userFound.lastSentLoginTokenAt).add(tryMintue, 'm').toDate();
    //     if (moment().diff(canRetyAfterDate, 'seconds') <= 0) {
    //       loggerInfo('!(EMAIL FAILED TO SEND)', { acceptInvite, email })
    //       throw new ApolloError('wait_for_minute_to_get_new_code', undefined, { tryMintue: tryMintue })
    //     }
    //   } else {
    //     isFirstLogin = true;
    //   }
    // } else {
    //   isFirstLogin = true;
    // }
   
    const token = loginToken(email);
    await models.User.updateOne({ _id: userFound.id }, { Token: token });

    const inviteSearchValues = !acceptInvite
      ? ''
      : ("otp?email=" + email
        + "&acceptInvite=true"
        + "&projectId=" + acceptInvite.projectId
        + "&languageCode=" + acceptInvite.languageCode
        + "&inviteToken=" + acceptInvite.token)

    sendLoginMail(email, token, userFound.languageCode, acceptInvite);
    let retryCount = isFirstLogin ? 1 : ((userFound?.loginDetail?.retryCount || 0) + 1)

    await models.User.updateOne({ _id: userFound.id },
      {
        lastSentLoginTokenAt: new Date(),
        loginDetail: {
          userAgent: userAgent,
          retryCount: retryCount,
          userIp: userIpPassedByGateway
        },
      }
    );

    loggerInfo({ inviteSearchValues })
    return !!acceptInvite ? inviteSearchValues : userFound.id;

  } catch (e) {
    console.log('error', { e })
    loggerError('mailLogin Error', { e })
    return e
  }
};

const confirmLoginToken = async (_, { email, token: otp, forOneYear }, { models, userIpPassedByGateway, userAgent }) => {
  try {
    const userFound = await models.User.findOne(
      { Email: { $regex: getEmailRegex(email) } },
      'Email ClientId Permissions Roles deviceAccount jwtToken Token otpFails'
    ).exec();

    loggerInfo('confirmLoginToken', { userFound, otp, userIpPassedByGateway, userAgent });


    if (userFound && email.length === userFound.Email.length) {
      const otpMatched = otp === userFound.Token;
      const otpFails = (userFound.otpFails || []).filter(x => x.userIp == userIpPassedByGateway)
      const otpFailsLength = otpFails.length

      if (otpFails.length > 0) {
        // const isLockedOut = otpFailsLength > 4

        // if (isLockedOut) throw new ApolloError('account_locked')

        const latestFailTime = otpFails[otpFailsLength - 1].failedAt
        let tryMintue = Math.floor(Math.pow(2, otpFailsLength - 3));
        const currentLoginTime = new Date()
        let canRetyAfterDate = moment(latestFailTime).add(tryMintue, 'm').toDate();

        const isLoginBlocked = moment().diff(canRetyAfterDate, 'seconds') <= 0

        loggerInfo({
          otpFails,
          latestFailTime,
          currentLoginTime
        })

         if (isLoginBlocked) throw new ApolloError('login_blocked');

      }
      // check if otp matches
      if (!otpMatched) {
        let errMsg = 'error'
        let shouldUpdateToken = false

        if (otpFailsLength >= 2) {
          shouldUpdateToken = true

          if (otpFailsLength >= 4) errMsg = 'account_locked'
          else errMsg = 'login_blocked'
        }

        await models.User.updateOne(
          { _id: userFound.id },
          {
            ...shouldUpdateToken && { Token: loginToken(email), },
            ...email === 'app@aktenplatz.de'
              ? { otpFails: [] }
              : {
                $push: {
                  otpFails: {
                    failedAt: new Date(),
                    userIp: userIpPassedByGateway
                  }
                }
              }
          }
        )
        throw new ApolloError(errMsg)
      }

      await models.User.updateOne({ _id: userFound.id }, {
        otpFails: (userFound.otpFails || []).filter(x => x.userIp != userIpPassedByGateway && x.userIp),
        loginDetail: {
          retryCount: 0
        }
      })

      let validToken;

      if (userFound.jwtToken) {

        validToken = jwt.verify(
          userFound.jwtToken,
          process.env.JwtToken,
          (err, verifiedJwt) => {

            loggerInfo('verify  jwt', { err, verifiedJwt })

            if (err) {

              loggerInfo({ err })

              return false;
            } else {

              return verifiedJwt;
            }

          }
        )

      }

      loggerInfo({ validToken, userFound })

      if (validToken && userFound.jwtToken) {
        await models.User.updateOne(
          { _id: userFound.id },
          {
            Token: loginToken(email),
            lastSignedIn: new Date(),
            otpFails: (userFound.otpFails || []).filter(x => x.userIp != userIpPassedByGateway && x.userIp),
            loginDetail: {
              retryCount: 0
            }
          }
        );
        return userFound.jwtToken
      } else {
        const Hash = crypto.randomBytes(32).toString('hex');
        const jwtToken = jwt.sign(
          {
            "https://backend.aktenplatz.de/graphql": {
              Roles: userFound.Roles,
              ClientId: userFound.ClientId,
              Permissions: userFound.Permissions,
              Hash,
            }
          },
          process.env.JwtToken,
          {
            algorithm: "HS256",
            subject: userFound.id,
            expiresIn: (userFound.deviceAccount || forOneYear) ? "365d" : "14d"
          }
        );

        await models.User.updateOne(
          { _id: userFound.id },
          {
            Hash,
            Token: loginToken(email),
            jwtToken,
            lastSignedIn: new Date(),
            otpFails: (userFound.otpFails || []).filter(x => x.userIp != userIpPassedByGateway && x.userIp),
          },
        );

        return jwtToken
      }

    } else throw new ApolloError("email_did_not_match")
    // } else throw new ApolloError("pin_did_not_match")
  } catch (e) {
    loggerError('!ERROR: (confirmLoginToken)', { e })
    return e
  }
};


const createUser = async (parent, { email, languageCode, acceptInvite, customFields }, { models }) => {
  try {
    if (!emailPattern.test(email))
      throw new ApolloError('invalid_email')

    //check if mail already exists
    const dbUser = await models.User.findOne(
      { Email: { $regex: getEmailRegex(email) } },
      'Email'
    ).exec();

    if (dbUser) return 'user_already_exist'
    else {
      //create new temp Token
      const Hash = crypto.randomBytes(32).toString('hex');
      const roles = ["user"];
      const permissions = ["read:own_account"];
      //create new login Token
      const token = loginToken(email);
      const clientId = new mongoose.mongo.ObjectId();
      const user = await models.User.create({
        ClientId: clientId,
        Email: email,
        Roles: roles,
        Permissions: permissions,
        Hash: Hash,
        Token: token,
        languageCode,
        deviceAccount: false,
        weeklyHour: 40,
        workingDays: 5
      });
      sendNewAccountMail(email, token, languageCode, acceptInvite);
      addListMember(email);

      // create user's first project
      if (customFields) {
        let url = process.env.GatewayService
        let mutate_object = {
          mutation: gql`
            mutation createUserFirstProject(
                  $email: String!, 
                  $token: String!, 
                  $customFields: [CreateCustomFieldInput]
                ) {
                  createUserFirstProject(
                    email: $email, 
                    token: $token, 
                    customFields: $customFields
                  ) {
                    category
                    createdAt
                    description
                    name
                    url
                    id
                    updatedAt
                  }
                }
      `,
          variables: {
            token: token,
            email: email,
            customFields: customFields.map(cf => ({ type: cf.type, label: cf.label })),
          },
        }

        await client_gql_mutate(url, mutate_object)
        return "success";
      }
      return token;
    }
  }
  catch (e) {
    loggerError('!ERROR createUser', { e })
    return e
  }
}

const updateUser = async (
  _,
  {
    name,
    avatarFileId,
    languageCode,
    avatarColor,
    countAllOpenTasks,
    disableAutoRefresh,
    weeklyHour,
    workingDays,
    descriptionTemplate,
    countOnlyWeeklyHours
  },
  { models, user }
) => {
  try {
    await models.User.updateOne(
      { _id: user.sub },
      {
        name,
        avatarFileId,
        languageCode,
        avatarColor,
        countAllOpenTasks,
        disableAutoRefresh,
        weeklyHour,
        workingDays,
        descriptionTemplate,
        countOnlyWeeklyHours
      }
    );
    return "Update User Success"
  } catch (e) {
    return e;
  }
}

/**
 * API to delete user and his/her projects together with associated issues and files.
 * 
 * @param {*} _ 
 * @param {*} param1 
 * @param {*} param2 
 * @returns 
 */
const deleteUser = async (_, { email }, { models, user }) => {
  const dbUser = await models.User.findOne({ Email: email }, 'Email').exec();
  if (dbUser) {
    let url = process.env.GatewayService
    let mutate_object = {
      mutation: gql`
          mutation DeleteProjectFromUser($email: String!, $userId: String!) {
            deleteProjectFromUser(email: $email, userId: $userId) {
              message
              status
            }
          }
      `,
      variables: {
        "userId": dbUser._id,
        "email": email
      },
    }

    let response = await client_gql_mutate(url, mutate_object)
    if (response && response.data.deleteProjectFromUser.status) {
      loggerInfo(`deleting user now...`)
      const deleted = await models.User.deleteOne({ _id: dbUser._id })
      if (deleted) {
        await log({
          _relation: 'user',
          _relation_id: dbUser._id,
          _action: 'delete',
          _user: dbUser._id
        });
        return {
          status: true,
          message: "User Deleted"
        }
      } else {
        return {
          status: false,
          message: response.data.deleteProjectFromUser.message
        }
      }
    }
    return {
      status: false,
      message: response.data.deleteProjectFromUser.message
    };
  }
}

const updateUserEmail = async (_, { email, newEmail }, { models, user }) => {
  loggerInfo('--------updateUserEmail----------')
  try {

    if (!emailPattern.test(newEmail))
      throw new ApolloError('invalid_email')

    const userFound = await models.User.findOne(
      { Email: { $regex: getEmailRegex(email) } },
      'languageCode id Email changeEmail'
    );

    if (userFound === null)
      throw new ApolloError('user_not_found')

    if (userFound && email.length !== userFound.Email.length)
      throw new ApolloError('email_did_not_match')

    const langCode = userFound.languageCode || 'de';
    const existingEmailUser = await models.User.findOne(
      { Email: { $regex: getEmailRegex(newEmail) } },
      'Email'
    ).exec();

    if (existingEmailUser && existingEmailUser.Email.length === newEmail.length)
      throw new ApolloError('email_already_used')

    let isDifferentEmail = false;
    if (userFound && userFound.changeEmail) {
      if (userFound?.changeEmail?.newEmail == newEmail && userFound?.changeEmail?.updatedAt) {
        let tryMintue = userFound?.changeEmail?.retryCount || 0;
        let canRetyAfterDate = moment(userFound?.changeEmail?.updatedAt).add(tryMintue, 'm').toDate();
        if (moment().diff(canRetyAfterDate, 'seconds') <= 0) {
          throw new ApolloError('email_already_sent');
        }
      } else {
        isDifferentEmail = true;
      }
    }


    loggerInfo('updateUserEmail', {
      email, newEmail, userFound, existingEmailUser,
      'email.length': email.length,
      'userFound.Email.length': userFound.Email.length
    })

    // update temp token
    const token = loginToken(newEmail)
    let retryCount = isDifferentEmail ? 1 : ((userFound?.changeEmail?.retryCount || 0) + 1)
    const updatedUser = await models.User.updateOne(
      { _id: userFound._id },
      {
        changeEmail: {
          newEmail, token,
          updatedAt: new Date(),
          retryCount: retryCount
        }
      },
    )

    if (updatedUser.modifiedCount) {
      sendUpdateAccountMail(newEmail, email, token, langCode);
      await log({
        _relation: 'user',
        _relation_id: userFound._id,
        _action: 'send_update_email',
        _user: userFound._id
      });
    }

  } catch (e) {
    loggerError('ERROR: (updateUserEmail) ', { e })
    return e
  }
}

const confirmNewEmail = async (_, { email, token }, { models }) => {
  try {
    const userFound = await models.User.findOne(
      {
        'changeEmail.newEmail': { $regex: getEmailRegex(email) },
        'changeEmail.token': token
      },
    );

    if (userFound === null) throw new ApolloError('user_not_found')
    if (email.length !== userFound.changeEmail.newEmail.length)
      throw new ApolloError('email_did_not_match')

    loggerInfo('confirmLoginToken', { userFound });

    const validToken = userFound.jwtToken && jwt.verify(
      userFound.jwtToken,
      process.env.JwtToken,
      (err, verifiedJwt) => {

        loggerInfo('verify  jwt', { err, verifiedJwt })
        if (err) {
          loggerInfo({ err })
          return false;
        } else {
          return verifiedJwt;
        }

      }
    )

    if (!Boolean(validToken)) throw new ApolloError('invalid_token')

    const Hash = crypto.randomBytes(32).toString('hex');
    const jwtToken = jwt.sign(
      {
        "https://backend.aktenplatz.de/graphql": {
          Roles: userFound.Roles,
          ClientId: userFound.ClientId,
          Permissions: userFound.Permissions,
          Hash,
        }
      },
      process.env.JwtToken,
      {
        algorithm: "HS256",
        subject: userFound.id,
        expiresIn: userFound.deviceAccount ? "365d" : "14d"
      }
    );

    await models.User.updateOne(
      { _id: userFound.id },
      {
        Hash,
        Token: loginToken(email),
        jwtToken,
        changeEmail: null,
        Email: email
      },
    );
    addListMember(email);

    return jwtToken

  } catch (e) {
    loggerError('ERROR: (confirmNewEmail) ', { e })
    return e
  }
}

const updateTimeTrackerStatus = async (
  _,
  {
    timeTrackerStatus
  },
  { models, user }
) => {
  try {
    const _oid = (new mongoose.mongo.ObjectId()).toString();

    const deserializedStatus = JSON.parse(timeTrackerStatus);
    if (deserializedStatus.currentTrackingId == '')
      deserializedStatus.currentTrackingId = _oid

    await models.User.updateOne(
      { _id: user.sub },
      {
        timeTrackerStatus: JSON.stringify(deserializedStatus),
        timeTrackerStatusUpdateAt: new Date()
      }
    );
    return deserializedStatus.currentTrackingId;
  } catch (e) {
    return e;
  }
}

module.exports = {
  mailLogin,
  confirmLoginToken,
  createUser,
  updateUser,
  deleteUser,
  updateUserEmail,
  confirmNewEmail,
  updateTimeTrackerStatus,
}
