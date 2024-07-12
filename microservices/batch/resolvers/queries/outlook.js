const { getAuthUrl, getMe, getClientWithUpdateToken, } = require('../../helper/AuthHelper');
const { getOutlookCalendars, getEvent } = require('../../helper/OutlookEventHelper');
const { getUserContacts } = require('../../helper/ContactHelper');
const { ApolloError } = require("apollo-server-express");
const mongoose = require("mongoose");
const moment = require('moment')
const momentTz = require("moment-timezone");
const { allDayDateFormat, dateFormat, defaultTimeZone } = require('../../constants/calendar');
const { loggerInfo, loggerError } = require('../../config/logger')


const outlookAuthUrl = async (_, __,) => {
  const authUrl = await getAuthUrl()
  if (!authUrl) throw new ApolloError('auth_url_not_found')
  return authUrl
};

const outlookCalendars = async (_, { projectId }, { models }) => {
  try {
    const projectFound = await models.Project.findById(projectId)

    const projectWithCalendars = await models.Project.find({ 'outlook.calendarId': { $not: { $eq: null } } })
    const selectedCalendarIds = projectWithCalendars.map(p => p.outlook && p.outlook.calendarId)

    const { accessToken, refreshToken } = await projectFound && projectFound.outlook || {}

    const client = await getClientWithUpdateToken({ accessToken, refreshToken, models, projectId, })

    return await getOutlookCalendars(client, selectedCalendarIds)
  } catch (e) {
    loggerError('!ERROR: (outlookCalendars),', { e })
    return e
  }
};

const outlookTokenStatus = async (_, { projectId }, { models }) => {
  try {
    const projectFound = await models.Project.findById(projectId, 'outlook')

    const projectOutlook = projectFound.outlook || {}
    const { accessToken, refreshToken } = projectOutlook

    const client = await getClientWithUpdateToken({
      accessToken,
      refreshToken,
      models,
      projectId
    })

    const me = await getMe(client)

    const active = !!(me && me.accountId)

    return { active }

  } catch (e) {
    return { active: false }
  }
};

const outlookUser = async (_, { projectId }, { models }) => {
  try {
    const projectFound = await models.Project.findById(projectId, 'outlook outlookAccount')
    if (!projectFound) throw new ApolloError('no_project_found')

    const projectOutlook = projectFound.outlook || {}
    const { accessToken, refreshToken } = projectOutlook

    let displayName = projectOutlook.accountName;
    let mail = projectOutlook.accountMail;
    let accountId = projectOutlook.accountId;

    if (!mail) {

      const client = await getClientWithUpdateToken({
        accessToken,
        refreshToken,
        models,
        projectId
      })
      const me = await getMe(client)

      if (me) {
        displayName = me.displayName;
        mail = me.mail;
        accountId = me.accountId;
      }
    }

    return {
      displayName,
      mail,
      accountId,
    }
  } catch (e) {
    return e
  }
};

const outlookSync = async (_, { projectId }, { models }) => {
  try {
    const outlookSyncFound = await models.OutlookSync.findOne(
      { projectId },
      'projectId status syncEndAt failedAt isFirstSync'
    )
    if (outlookSyncFound)
      return {
        id: outlookSyncFound._id,
        projectId: outlookSyncFound.projectId,
        status: outlookSyncFound.status,
        syncEndAt: outlookSyncFound.syncEndAt,
        failedAt: outlookSyncFound.failedAt,
        isFirstSync: outlookSyncFound.isFirstSync,
      }
    else return null
  } catch (e) {
    return e
  }
};

const outlookEvent = async (_, { projectId, outlookEventId }, { models }) => {
  try {
    const projectFound = await models.Project.findById(projectId, 'outlook')
    const { accessToken, refreshToken } = projectFound && projectFound.outlook || {}
    const event = await getEvent(accessToken, refreshToken, outlookEventId)
    loggerInfo('event', event)
    return 'event'
  } catch (e) {
    return e
  }
};

const outlookContacts = async (_, { projectId }, { models }) => {
  try {
    const projectFound = await models.Project.findById(projectId)
    const { accessToken, refreshToken } = await projectFound && projectFound.outlook || {}
    const client = await getClientWithUpdateToken({
      accessToken,
      refreshToken,
      projectId,
      models,
    })
    loggerInfo('client', { client, accessToken, refreshToken })
    return await getUserContacts(client, projectId)
  } catch (e) {
    return e
  }
};

const outlookContactSync = async (_, { projectId }, { models }) => {
  try {
    const outlookContactSyncFound = await models.OutlookContactSync.findOne(
      { projectId },
      'projectId status syncEndAt failedAt isFirstSync'
    )
    if (outlookContactSyncFound)
      return {
        id: outlookContactSyncFound._id,
        projectId: outlookContactSyncFound.projectId,
        status: outlookContactSyncFound.status,
        syncEndAt: outlookContactSyncFound.syncEndAt,
        failedAt: outlookContactSyncFound.failedAt,
        isFirstSync: outlookContactSyncFound.isFirstSync,
      }
    else return null
  } catch (e) {
    return e
  }
};

const searchOutlookEmail = async (_, { query }, { models, user }) => {
  try {
    loggerInfo(mongoose.Types.ObjectId(user.sub), query);
    let pObjId = mongoose.Types.ObjectId(user.sub);
    // '*'+query+'*'
    const result = await models.OutlookMail.aggregate(
      [
        {
          '$search': {
            'index': 'nav_email_search',
            'compound': {
              'should': [
                {
                  'wildcard': {
                    'query': '*' + query + '*',
                    'path': 'body.bodyPreview',
                    'allowAnalyzedField': true
                  }
                }, {
                  'wildcard': {
                    'query': '*' + query + '*',
                    'path': [
                      'subject', 'from.emailAddress.name', 'from.emailAddress.address', 'toRecipients.emailAddress.name', 'toRecipients.emailAddress.address'
                    ],
                    'allowAnalyzedField': true,
                    'score': {
                      'boost': {
                        'value': 10
                      }
                    }
                  }
                }, {
                  'text': {
                    'query': query,
                    'path': 'body.bodyPreview'
                  }
                }, {
                  'text': {
                    'query': query,
                    'path': [
                      'subject', 'from.emailAddress.name', 'from.emailAddress.address', 'toRecipients.emailAddress.name', 'toRecipients.emailAddress.address'
                    ],
                    'score': {
                      'boost': {
                        'value': 10
                      }
                    }
                  }
                }
              ]
            },
            'highlight': {
              'path': [
                'body.bodyPreview', 'subject', 'from.emailAddress.name', 'from.emailAddress.address', 'toRecipients.emailAddress.name', 'toRecipients.emailAddress.address'
              ]
            }
          }
        }, {
          '$project': {
            'projectIdStr': {
              '$toString': '$projectId'
            },
            'highlights': {
              '$meta': 'searchHighlights'
            },
            'mailId': {
              '$toString': '$_id'
            },
            'webLink': 1,
            'from': 1,
            'toRecipients': 1,
            'receivedDateTime': 1,
            'subject': 1,
            'projectId': 1
          }
        }, {
          '$lookup': {
            'from': 'col_Projects',
            'localField': 'projectId',
            'foreignField': '_id',
            'as': 'projectInfo'
          }
        }, {
          '$unwind': {
            'path': '$projectInfo'
          }
        }, {
          '$match': {
            'projectInfo.users.userId': {
              '$all': [
                pObjId
              ]
            }
          }
        }
      ]
    );
    return result.map((mail) => {
      return {
        id: mail.mailId,
        projectId: mail.projectIdStr,
        highlights: mail.highlights,
        webLink: mail.webLink,
        from: mail.from.emailAddress.name + "<" + mail.from.emailAddress.address + ">",
        to: mail.toRecipients.map(ad => ad.emailAddress.name + "<" + ad.emailAddress.address + ">").join(', '),
        receivedDateTime: mail.receivedDateTime.toISOString(),
        subject: mail.subject
      }
    });
  } catch (e) {
    return e
  }
};

const getTime = async (_, { timeString, isAllDay, timeZone }, { }) => {
  try {
    const dateTimeFormat = isAllDay ? allDayDateFormat : dateFormat
    const tZ = timeZone || defaultTimeZone

    const time = new Date(timeString);
    const momentTime = moment(time).format(dateTimeFormat);
    const momentTimeUTC = momentTz(time).tz('UTC').format(dateTimeFormat);
    const momentTimeTz = momentTz(time).tz(tZ).format(dateTimeFormat);

    const outlookEventStartString = 'Wed Jan 25 2023 01:00:00 GMT+0100 (Central European Standard Time)'
    const eventStartString = '2023-01-25T02:00:00.000000'

    const oeStartDate = new Date(outlookEventStartString)
    const eStartDate = new Date(eventStartString)

    const oeStart = momentTz(oeStartDate).tz(tZ).format(dateTimeFormat);
    const eStart = momentTz(eStartDate).tz('UTC').format(dateTimeFormat);
    const isStartDateSame = moment(oeStart).isSame(moment(eStart));

    loggerInfo({
      dateTimeFormat,
      timeString,
      time,
      momentTime,
      momentTimeUTC,
      momentTimeTz,

      oeStartDate,
      eStartDate,
      oeStart,
      eStart,
      isStartDateSame,
    })
  } catch (e) {
    loggerError({ e })
    return false
  }
}

module.exports = {
  outlookAuthUrl,
  outlookCalendars,
  outlookUser,
  outlookSync,
  outlookEvent,
  outlookContacts,
  outlookContactSync,
  searchOutlookEmail,
  outlookTokenStatus,
  getTime
}
