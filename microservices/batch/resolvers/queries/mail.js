const { getClientWithUpdateToken } = require('../../helper/AuthHelper');
const mongoose = require('mongoose');
const { ApolloError } = require('apollo-server-express');
const { loggerInfo, loggerError } = require('../../config/logger');
const { getMailFolders, getMailChildFolders } = require('../../helper/OutlookMailFolderHelper');

const getSubscription = async (_, { projectId, subscriptionId }, { models, user }) => {
  try {
    let accessToken;
    const projectFound = await models.Project.findById(
      projectId,
      'outlook'
    )
    const { accessToken: accTok, refreshToken } = await projectFound && projectFound.outlook || {};
    accessToken = await accTok;
    const client = await getClientWithUpdateToken({ projectId, models, accessToken, refreshToken })

    const message = await client
      .api(`/subscriptions/${subscriptionId}`)
      // .select('subject,id')
      .get();

    loggerInfo({ message })
    return true
  } catch (error) {
    loggerError({ error })
    return false
  }
}

const listSubscriptions = async (_, { projectId }, { models, user }) => {
  try {
    let accessToken;
    const projectFound = await models.Project.findById(
      projectId,
      'outlook'
    )
    const { accessToken: accTok, refreshToken } = await projectFound && projectFound.outlook || {};
    accessToken = await accTok;
    const client = await getClientWithUpdateToken({ projectId, models, accessToken, refreshToken })

    let subscriptions = [];
    const results = await client
      .api(`/subscriptions`)
      .get();

    subscriptions = results && results.value || []
    let nextLink = results['@odata.nextLink']

    while (nextLink) {
      const nextResults = await client.api(nextLink).get();
      subscriptions = [...subscriptions, ...nextResults ? nextResults.value : []]
      nextLink = nextResults['@odata.nextLink']
    }
    loggerInfo(JSON.stringify(subscriptions, null, 2))

    return true
  } catch (error) {
    loggerInfo(error)
    return false
  }
}


const columnOutlookMails = async (_, { projectId, columnKey, offset, limit }, { models, user }) => {
  try {
    const pObjId = mongoose.Types.ObjectId(user.sub);
    const projectFound = await models.Project.findById(projectId, 'outlookEmailColumnEnabled')
    if (!projectFound) throw new ApolloError('project_not_found')

    const result = await models.OutlookMail.aggregate(
      [
        {
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
            'projectId': 1,
            'columnKey': 1,
            'columnPosition': 1
          },
        },
        {
          '$lookup': {
            'from': 'col_Projects',
            'localField': 'projectId',
            'foreignField': '_id',
            'as': 'projectInfo'
          }
        },
        {
          '$unwind': {
            'path': '$projectInfo'
          }
        },
        {
          '$match': {
            'projectInfo.users.userId': {
              '$all': [
                pObjId
              ]
            },
            'columnKey': columnKey,
            'projectId': mongoose.Types.ObjectId(projectId)
          }
        },
        {
          $sort: {
            columnPosition: 1,
            _id: 1,
          }
        }
      ]
    );

    const resultsColPosList = result.map(r => r.columnPosition)
    const nullColPos = resultsColPosList.filter(pos => pos === null || pos === undefined)
    const resultsColPosListWithValue = resultsColPosList.filter(pos => Boolean(pos))
    const uniqueColPos = [...new Set(resultsColPosListWithValue)]
    const hasDuplicate = resultsColPosListWithValue.length !== uniqueColPos.length
    const hasNull = nullColPos.length > 0

    // set column position for mails without column position value
    if (hasDuplicate || hasNull) {

      const bulkOps = []

      let i = 0
      for (const mail of result) {
        bulkOps.push({
          updateOne: {
            filter: { _id: mongoose.Types.ObjectId(mail.mailId) },
            update: { columnPosition: i }
          }
        })

        i += 1;
      }

      loggerInfo({ bulkOps: JSON.stringify(bulkOps) })
      await models.OutlookMail.bulkWrite(bulkOps)
    }

    const emailIds = result.map(r => r._id)

    const emails = await models.OutlookMail.find({ _id: { $in: emailIds } })
      .sort('columnPosition')
      .skip(offset)
      .limit(limit)


    const mailResults = emails.map((mail) => ({
      id: mail.id,
      projectId: mail.projectId,
      highlights: mail.highlights || [],
      webLink: mail.webLink,
      from: mail.from.emailAddress.name + "<" + mail.from.emailAddress.address + ">",
      to: mail.toRecipients.map(ad => ad.emailAddress.name + "<" + ad.emailAddress.address + ">").join(', '),
      receivedDateTime: mail.receivedDateTime.toISOString(),
      subject: mail.subject,
      columnKey: mail.columnKey,
      columnPosition: mail.columnPosition,
      // columnPosition: mail.columnPosition === null || mail.columnPosition === undefined
      //   ? leastColumnPosition + ((indexOfLowest - index) * -1)
      //   : mail.columnPosition,
    }))

    return {
      outlookMails: mailResults,
      isMailDisplayedInBoard: projectFound.outlookEmailColumnEnabled
    }
  } catch (e) {
    return e
  }
};

const outlookFoldersOpts = async (_, { projectId }, { models }) => {
  try {
    const projectFound = await models.Project.findById(projectId, 'outlook')
    const { accessToken, refreshToken } = await projectFound && projectFound.outlook || {};

    const client = await getClientWithUpdateToken({
      projectId,
      models,
      accessToken,
      refreshToken
    })

    const folderOpts = []

    const folders = await getMailFolders(client)

    for (const folder of folders) {
      folderOpts.push({
        value: folder.id,
        label: folder.displayName,
      })
      if (folder.childFolderCount) {
        const foldersChildren = await getMailChildFolders(client, folder.id)
        for (const childFolder of foldersChildren) {
          folderOpts.push({
            value: childFolder.id,
            label: folder.displayName + " > " + childFolder.displayName,
          })
          if (childFolder.childFolderCount) {
            const foldersGrandChildren = await getMailChildFolders(client, childFolder.id)
            for (const grandChildFolder of foldersGrandChildren) {
              folderOpts.push({
                value: grandChildFolder.id,
                label:
                  folder.displayName + " > " +
                  childFolder.displayName + " > " +
                  grandChildFolder.displayName,
              })
            }
          }
        }
      }

    }

    return folderOpts

  } catch (error) {
    loggerError()
    return error
  }
}

const projectOutlookMails = async (_, { projectId, offset, limit }, { models, user }) => {
  try {
    const pObjId = mongoose.Types.ObjectId(user.sub);
    const projectFound = await models.Project.findById(projectId, 'outlookEmailColumnEnabled')
    if (!projectFound) throw new ApolloError('project_not_found')

    const mailAggregateFilters =
      [
        {
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
            'projectId': 1,
            'columnKey': 1,
            'columnPosition': 1
          },
        },
        {
          '$lookup': {
            'from': 'col_Projects',
            'localField': 'projectId',
            'foreignField': '_id',
            'as': 'projectInfo'
          }
        },
        {
          '$unwind': {
            'path': '$projectInfo'
          }
        },
        {
          '$match': {
            'projectInfo.users.userId': {
              '$all': [
                pObjId
              ]
            },
            'projectId': mongoose.Types.ObjectId(projectId)
          }
        }
      ]

    const mailsTotalCount = await models.OutlookMail.aggregate([
      ...mailAggregateFilters,
      { $count: 'totalCount' }
    ])

    const mailsFound = await models.OutlookMail.aggregate(
      [
        ...mailAggregateFilters,
        {
          $sort: {
            updatedAt: -1,
            createdAt: -1,
            _id: -1,
          }
        },
        { $skip: offset || 0 },
        { $limit: limit || 20 },
      ]
    );

    const mailResults = mailsFound.map((mail) => ({
      id: mail._id,
      projectId: mail.projectId,
      highlights: mail.highlights || [],
      webLink: mail.webLink,
      from: mail.from.emailAddress.name + "<" + mail.from.emailAddress.address + ">",
      to: mail.toRecipients.map(ad => ad.emailAddress.name + "<" + ad.emailAddress.address + ">").join(', '),
      receivedDateTime: mail.receivedDateTime.toISOString(),
      subject: mail.subject,
      columnKey: mail.columnKey,
      columnPosition: mail.columnPosition,
      updatedAt: mail.updatedAt,
    }))

    const totalCount = mailsTotalCount && mailsTotalCount[0] ? mailsTotalCount[0].totalCount : 0
    const solvedOffset = offset + limit;
    const hasMore = solvedOffset < totalCount;
    const nextOffset = hasMore ? solvedOffset : totalCount;
    loggerInfo('projectOutlookMails', {
      totalCount,
      mailsTotalCount,
      solvedOffset,
      hasMore,
      nextOffset,
    })
    return {
      outlookMails: mailResults,
      totalCount,
      hasMore,
      nextOffset
    }
  } catch (e) {
    return e
  }
};

module.exports = {
  getSubscription,
  listSubscriptions,
  columnOutlookMails,
  outlookFoldersOpts,
  projectOutlookMails
}