const { getClientWithUpdateToken } = require('../../helper/AuthHelper');
const {
  getOutlookMails,
  getOutlookMail,
  deleteOutlookMailSubscription,
  updateOutlookMailSubscriptionExpiration,
  moveMessageFolder,
  formatMailFromOutlook,
  formatMailsFromOutlook,
} = require('../../helper/OutlookMailHelper');
const { ApolloError } = require('apollo-server-express');
const { loggerInfo, loggerError } = require('../../config/logger');
const {
  getMailChildFolders,
  getAktenplatzMailFolderInOutlook,
  createMailChildFolder,
  getFolderMessages,
  getMailFolders,
  getMailFolder,
  getMailFolderFilterName
} = require('../../helper/OutlookMailFolderHelper');
const mongoose = require('mongoose');
const { MailJobStatus } = require('../../constants/mailJob');
const e = require('express');

const createMailSubscription = async (_, { projectId }, { models, user }) => {
  try {
    const projectFound = await models.Project.findById(
      projectId,
      'outlook selectedOutlookEmailsColumn'
    )

    if (!projectFound) return 'Project Not Found'

    const projectOutlook = projectFound.outlook || {}
    const accessToken = await projectOutlook.accessToken;
    const { refreshToken, syncMailEnabled, accountMail } = projectOutlook;

    const client = await getClientWithUpdateToken({ projectId, models, accessToken, refreshToken })

    loggerInfo({ client })

    const notificationHost = process.env.NOTIFICATION_HOST;
    const expiration = new Date(Date.now() + 253800000).toISOString();
    const existingSubscription = await models.Subscription.findOne({ projectId: projectId })
    const existingProjWithSameSubAcc = await models.Project.findOne(
      {
        _id: { $ne: projectId },
        "outlook.accountMail": accountMail,
        mailSubscribed: true
      },
      { _id: 0, mailSubscribed: 1, "outlook.accountMail": 1 }
    )

    //check if another project has a subscription with the same  exists return message
    if (existingProjWithSameSubAcc && existingProjWithSameSubAcc !== null)
      return 'Another Project has a subscription with the same Email'

    //check if subscription exists return message
    if (existingSubscription && existingSubscription !== null) return 'Subscription Exists'

    //save first the existing mails from outlook to db
    if (syncMailEnabled) {
      const mails = await getOutlookMails(client, projectId)
      loggerInfo({ mails })

      await models.OutlookMail.insertMany(mails.map(mail => ({
        ...mail,
        columnKey: projectFound.selectedOutlookEmailsColumn
      })))
    } else {
      return false;
    }

    // // Create the subscription
    const subscription = await client.api('/subscriptions').create({
      changeType: 'created',
      notificationUrl: `${notificationHost}/subscribe?projectId=${projectId}`,
      resource: `/me/mailfolders('inbox')/messages`,
      clientState: process.env.SUBSCRIPTION_CLIENT_STATE,
      includeResourceData: false,
      expirationDateTime: expiration,
    });

    if (subscription) {
      await models.Project.updateOne({ _id: projectId }, { mailSubscribed: true })
    }

    loggerInfo({ subscription })

    if (subscription.id !== null) {
      await models.Subscription.create({
        userId: user.sub,
        projectId,
        subscriptionId: subscription.id,
        expirationDateTime: subscription.expirationDateTime,
        resource: subscription.resource,
      })
    }

    return true
  } catch (error) {
    loggerError({ error })
    return false
  }
}

const recreateMailSubscription = async (_, { projectId }, { models, user }) => {
  try {
    let accessToken;
    const projectFound = await models.Project.findById(
      projectId,
      'outlook'
    )
    const { accessToken: accTok, refreshToken, syncMailEnabled } = await projectFound && projectFound.outlook || {};
    accessToken = await accTok;
    const client = await getClientWithUpdateToken({ projectId, models, accessToken, refreshToken })

    loggerInfo({ client })
    const notificationHost = process.env.NOTIFICATION_HOST;
    const expiration = new Date(Date.now() + 253800000).toISOString();

    const existingSubscription = await models.Subscription.findOne({
      projectId: projectId,
      expirationDateTime: { $lte: new Date() }
    })

    loggerInfo({ existingSubscription })
    //check if project subscription is already expired or else return message
    if (existingSubscription) {
      await models.Subscription.deleteOne({ _id: existingSubscription._id });
      await models.Project.updateOne({ _id: projectId }, { mailSubscribed: false })
    } else {
      return 'Subscription Not Expired'
    }

    // //save first the existing mails from outlook to db
    // if(syncMailEnabled) {
    //   const mails = await getOutlookMails(client, projectId)
    //   await models.OutlookMail.insertMany(mails)
    // } else {
    //   return false;
    // }

    // Create the subscription
    const subscription = await client.api('/subscriptions').create({
      changeType: 'created',
      notificationUrl: `${notificationHost}/subscribe?projectId=${projectId}`,
      resource: `/me/mailfolders('inbox')/messages`,
      clientState: process.env.SUBSCRIPTION_CLIENT_STATE,
      includeResourceData: false,
      expirationDateTime: expiration,
    });

    if (subscription) {
      await models.Project.updateOne({ _id: projectId }, { mailSubscribed: true })
    }

    loggerInfo({ subscription })

    if (subscription.id !== null) {
      await models.Subscription.create({
        userId: user.sub,
        projectId,
        subscriptionId: subscription.id,
        expirationDateTime: subscription.expirationDateTime,
        resource: subscription.resource,
      })
    }

    return true
  } catch (error) {
    loggerError({ error })
    return error
  }
}

const deleteSubscription = async (_, { projectId }, { models, user }) => {
  try {
    let accessToken;
    const projectFound = await models.Project.findById(
      projectId,
      'outlook'
    )
    const { accessToken: accTok, refreshToken } = await projectFound && projectFound.outlook || {};
    accessToken = await accTok;
    const client = await getClientWithUpdateToken({ projectId, models, accessToken, refreshToken })
    const deletedSubscription = await deleteOutlookMailSubscription(client, projectId, models)

    loggerInfo({ deletedSubscription })
    return true
  } catch (error) {
    loggerError({ error })
    return false
  }
}

const updateSubscriptionExpiration = async (_, { projectId }, { models, user }) => {
  try {
    let accessToken;
    const projectFound = await models.Project.findById(
      projectId,
      'outlook'
    )
    const { accessToken: accTok, refreshToken } = await projectFound && projectFound.outlook || {};
    accessToken = await accTok;
    const client = await getClientWithUpdateToken({ projectId, models, accessToken, refreshToken })
    const updatedSubscription = await updateOutlookMailSubscriptionExpiration(client, projectId, models)

    loggerInfo({ updatedSubscription })
    return true
  } catch (error) {
    loggerError({ error })
    return false
  }
}

const saveNewEmail = async (_, { projectId, messageId }, { models, user }) => {
  try {
    const projectFound = await models.Project.findById(
      projectId,
      'outlook selectedOutlookEmailsColumn outlookEmailColumnEnabled'
    )

    if (!projectFound) return 'Project Not Found'

    const projectOutlook = projectFound.outlook || {}
    const accessToken = await projectOutlook.accessToken;
    const { refreshToken, syncMailEnabled } = projectOutlook;

    loggerInfo({ refreshToken })

    if (syncMailEnabled) {
      const client = await getClientWithUpdateToken({ projectId, models, accessToken, refreshToken })
      const mail = await getOutlookMail(client, projectId, messageId)

      const existingMails = await models.OutlookMail.find({ outlookId: mail.outlookId })
      // if (existingMail && existingMail !== null) return 'Existing Mail'
      const hasExistingMail = (projId) => {
        return !!existingMails.find(m => String(m.projectId) === String(projId))
      }

      const accountId = mail.accountId
      const recipientsEmailAddresses = mail.toRecipients.map(r =>
        String(r.emailAddress.address).toLowerCase())

      const outlookEmailColumnEnabled = projectFound.outlookEmailColumnEnabled

      loggerInfo({ mail, accountId, existingMails, recipientsEmailAddresses })

      const rules = await models.OutlookMailRule.find({
        accountId,
        targetEmailAddress: { $in: recipientsEmailAddresses }
      })

      loggerInfo({ rules, outlookEmailColumnEnabled })

      // WARNING: if these codes needs to be updated or changed consider canging the code in refreshMailSubscription too
      if (rules.length <= 0 || !outlookEmailColumnEnabled) {
        const existingMailInProject = hasExistingMail(projectId)
        if (existingMailInProject) return 'Existing Mail'

        const mailId = mongoose.Types.ObjectId()

        await models.OutlookMail.create({
          _id: mailId,
          ...mail,
          columnKey: projectFound.selectedOutlookEmailsColumn,
        })

        await models.MailJob.create({
          projectId: projectId,
          mailId: mailId,
          mailOutlookId: mail.outlookId,
          targetProjectId: projectId,
          status: MailJobStatus.PENDING,
          createdAt: new Date()
        })

      } else {

        const rulesTargetProjectIds = rules.map(r => r.targetProjectId)

        const rulesTargetProjectsFound = await models.Project.find(
          { _id: { $in: rulesTargetProjectIds } },
          'selectedOutlookEmailsColumn'
        )

        loggerInfo({ rulesTargetProjectIds, rulesTargetProjectsFound })

        const outlookMailToCreate = []
        const mailJobsToCreate = []

        const targetProjsSelectColKeys = rulesTargetProjectsFound
          .filter(p => !!p.selectedOutlookEmailsColumn)
          .map(p => p.selectedOutlookEmailsColumn)

        const outlookMails = await models.OutlookMail.find(
          {
            columnKey: { $in: targetProjsSelectColKeys },
            projectId: { $in: rulesTargetProjectIds },
          },
          'columnPosition columnKey'
        )

        for (const rule of rules) {
          const targetProjectFound = rulesTargetProjectsFound.find(p =>
            String(p._id) === String(rule.targetProjectId))
          loggerInfo({ targetProjectFound })

          if (!targetProjectFound) loggerInfo('targetProjectFound not found', { projectId })
          else {

            const existingMailInProject = hasExistingMail(rule.targetProjectId)

            if (existingMailInProject) loggerInfo('Existing Mail')
            else {
              const columnKey = targetProjectFound.selectedOutlookEmailsColumn

              const columnOutlookMails = outlookMails.filter(m => m.columnKey === columnKey)
              const sortedOutlookMails = [...columnOutlookMails]
                .sort((a, b) => (a.columnPosition || 0) - (b.columnPosition || 0))
              const firstOutlookMail = sortedOutlookMails[0]
              const mailPosition = firstOutlookMail && firstOutlookMail.columnPosition
              const nextPosition = mailPosition ? mailPosition - 1 : 0

              const mailId = mongoose.Types.ObjectId()
              outlookMailToCreate.push({
                _id: mailId,
                ...mail,
                columnKey: columnKey,
                projectId: rule.targetProjectId,
                sourceProjectId: projectId,
                columnPosition: nextPosition
              })
              mailJobsToCreate.push({
                projectId: projectId,
                mailId: mailId,
                mailOutlookId: mail.outlookId,
                // accountId: mail.accountId,
                targetProjectId: rule.targetProjectId,
                status: MailJobStatus.PENDING,
              })
            }
          }
        }

        await models.OutlookMail.create(outlookMailToCreate)
        loggerInfo({ mailJobsToCreate: JSON.stringify(mailJobsToCreate) })
        await models.MailJob.create(mailJobsToCreate)

      }

      return true
    } else {
      return false;
    }
  } catch (error) {
    loggerError('!!ERROR saveNewEmail', { error })
    return false
  }
}

const changeProjectDefaultOutlookMailsColumn = async (_, { projectId, columnKey }, { models }) => {
  try {

    const projectFound = await models.Project.findById(projectId, 'selectedOutlookEmailsColumn')
    if (!projectFound) throw new ApolloError('project_not_found')

    const prevColKey = projectFound.selectedOutlookEmailsColumn;

    if (prevColKey !== columnKey) {

      await models.OutlookMail.updateMany(
        {
          projectId,
          columnKey: { $eq: prevColKey }
        },
        {
          columnKey,
          updatedAt: new Date()
        }
      )

      await models.Project.updateOne({ _id: projectId }, { selectedOutlookEmailsColumn: columnKey })

      return 'success'
    }

    return 'no_changes'
  } catch (error) {
    loggerError('ERR! changeProjectDefaultOutlookMailsColumn: ', { error })
    return false
  }
}

const removeProjectDefaultOutlookMailsColumn = async (_, { projectId }, { models }) => {
  try {
    await models.Project.updateOne(
      { _id: projectId },
      { selectedOutlookEmailsColumn: null }
    )
    return 'success'
  } catch (error) {
    loggerError('ERR! removeProjectDefaultOutlookMailsColumn: ', { error })
    return false
  }
}

const changeOutlookMailColumn = async (_, { outlookMailId, columnKey, columnPosition }, { models }) => {
  try {
    const outlookMailFound = await models.OutlookMail.findById(
      outlookMailId,
      'projectId outlookId sourceProjectId'
    )
    const projectId = outlookMailFound.projectId

    const projectFound = await models.Project.findById(projectId, 'columns')
    const projectColumns = projectFound.columns
    const projColumn = projectColumns.find(c => c.key === columnKey)
    const projColumnId = projColumn.id
    loggerInfo('changeOutlookMailColumn', { projColumn, projColumnId, outlookMailFound })

    if (!projColumn) throw new ApolloError('column_not_found')

    const updatedEmail = await models.OutlookMail.updateOne(
      { _id: outlookMailId },
      { columnKey, columnPosition }
    )

    const sourceProjectId = outlookMailFound.sourceProjectId || projectId

    await models.MailJob.create({
      projectId: sourceProjectId,
      mailId: outlookMailId,
      mailOutlookId: outlookMailFound.outlookId,
      targetProjectId: projectId,
      status: MailJobStatus.PENDING,
      targetProjectColumId: projColumnId
    })

    return updatedEmail.modifiedCount ? 'success' : "failed"
  } catch (error) {
    loggerError('ERR! changeOutlookMailColumn: ', { error })
    return false
  }
}

const removeOutlookMailColumn = async (_, { outlookMailId }, { models }) => {
  try {

    const updatedEmail = await models.OutlookMail.updateOne(
      { _id: outlookMailId },
      { columnKey: null }
    )

    return updatedEmail.modifiedCount ? 'success' : "failed"
  } catch (error) {
    loggerError('ERR! removeOutlookMailColumn: ', { error })
    return false
  }
}

const createMailJobTest = async (_, { projectId }, { models }) => {
  try {
    const projectFound = await models.Project.findById(projectId, 'outlook')
    if (!projectFound) return 'Project Not Found'

    const projectOutlook = projectFound.outlook || {}
    const accessToken = await projectOutlook.accessToken;
    const { refreshToken, syncMailEnabled } = projectOutlook;

    const client = await getClientWithUpdateToken({
      projectId,
      models,
      accessToken,
      refreshToken
    })
    // const messageId = 'AAMkAGZjYzAyZjAyLTMyMDEtNDlhYS1hMDk3LWMyOTA1ZDFhYWRlMQBGAAAAAAB9cH2nn6GnQrrZ6CfmJcvgBwAkCZ2U9lCUSZ3WrQH4jiMIAAAAAAEMAAAkCZ2U9lCUSZ3WrQH4jiMIAAASSm-fAAA='
    // const mail = await client.api(`/me/messages/${messageId}`)
    //   .header("Prefer", "IdType=\"ImmutableId\"")
    //   .get();

    // loggerInfo({ mail })
    const folderId = 'AAMkAGZjYzAyZjAyLTMyMDEtNDlhYS1hMDk3LWMyOTA1ZDFhYWRlMQAuAAAAAAB9cH2nn6GnQrrZ6CfmJcvgAQAkCZ2U9lCUSZ3WrQH4jiMIAAAAAAEMAAA='
    const mesgs = await getFolderMessages(client, folderId)
    const response = await getMailFolderFilterName('aktenplatz')

    loggerInfo('createMailJobTest', {
      mesgsLength: mesgs.length,
      msgs: mesgs.map(m => m.subject),
      response
    })

    return true
  } catch (error) {
    loggerError(error)
    return error
  }
}

const executeMailJob = async (_, { mailJobId }, { models }) => {
  try {
    loggerInfo('--------executeMailJob', { mailJobId })

    const mailJobFound = await models.MailJob.findById(mailJobId)
    if (!mailJobFound) throw new ApolloError('mail_job_not_found')

    const outlookMailFound = await models.OutlookMail.findById(mailJobFound.mailId)
    if (!outlookMailFound) throw new ApolloError('mail_not_found')

    await models.MailJob.updateOne(
      { _id: mailJobId },
      {
        status: MailJobStatus.EXECUTING,
        errorMessage: ''
      }
    )

    const projectId = mailJobFound.projectId
    const targetProjectId = mailJobFound.targetProjectId
    const mailOutlookId = outlookMailFound.outlookId
    const mailId = mailJobFound.mailId

    const projectFound = await models.Project.findById(projectId, 'outlook')
    if (!projectFound) throw new ApolloError('project_not_found')

    const targetProjectFound = await models.Project.findById(
      targetProjectId,
      'name selectedOutlookEmailsColumn columns'
    )
    if (!targetProjectFound) throw new ApolloError('target_project_not_found')

    const projectOutlook = projectFound.outlook || {}
    const accessToken = await projectOutlook.accessToken;
    const { refreshToken } = projectOutlook;

    const client = await getClientWithUpdateToken({
      projectId,
      models,
      accessToken,
      refreshToken
    })

    const folder = await getAktenplatzMailFolderInOutlook(client, projectId)
    loggerInfo('executeMailJob', { folder, mailJobFound })
    // const projectFound = await models.Project.findById(projectId, 'outlook')
    if (folder) {
      const parentFolderId = folder.id

      const targetProjCols = targetProjectFound.columns || []
      const targetProjColId = mailJobFound.targetProjectColumId
      const targetProjColFromMailJob = targetProjCols.find(c => String(c._id) === String(targetProjColId))

      loggerInfo('executeMailJob', {
        targetProjCols,
        targetProjColId,
        targetProjColFromMailJob,
      })

      const targetProjName = targetProjectFound.name
      const targetProjColName = targetProjColFromMailJob
        ? targetProjColFromMailJob.title
        : targetProjectFound.selectedOutlookEmailsColumn

      const childFolders = await getMailChildFolders(client, parentFolderId)
      let targetProjectFolder = await childFolders.find(f => f.displayName === targetProjName)
      if (!targetProjectFolder)
        targetProjectFolder = await createMailChildFolder(client, parentFolderId, targetProjName)

      loggerInfo('executeMailJob', {
        parentFolderId,
        childFolders,
        targetProjectFolder,
        targetProjName,
        targetProjColName
      })

      if (targetProjectFolder) {
        const targetProjFolderId = targetProjectFolder.id
        const childFolders = await getMailChildFolders(client, targetProjFolderId)

        let targetProjColFolder = await childFolders.find(f => f.displayName === targetProjColName)
        if (!targetProjColFolder)
          targetProjColFolder = await createMailChildFolder(client, targetProjFolderId, targetProjColName)

        // const movedMessage = await moveMessageFolder(client, mailOutlookId, destId)
        const movedMessage = await moveMessageFolder(client, mailOutlookId, targetProjColFolder.id)
        // should update the mail in db? outlookID and weblink
        loggerInfo('executeMailJob', { movedMessage: Boolean(movedMessage) })

        if (movedMessage) {
          await models.OutlookMail.updateOne(
            { _id: mailId },
            {
              outlookId: movedMessage.id,
              webLink: movedMessage.webLink
            }
          )

          await models.MailJob.updateOne({ _id: mailJobId }, {
            status: MailJobStatus.SUCCESS,
            newMailOutlookId: movedMessage.id,
          })
          return true

        } else {
          loggerError('noMovedMessage')
          throw new ApolloError('message_not_moved')
        }

      } else throw new ApolloError('no_target_project_folder')
    }

    await models.MailJob.updateOne({ _id: mailJobId }, {
      status: MailJobStatus.FAILED,
      errorMessage: 'return_false_no_folder'
    })

    return false
  } catch (error) {

    try {
      await models.MailJob.updateOne(
        { _id: mailJobId },
        {
          status: MailJobStatus.FAILED,
          errorMessage: error.message
        }
      )
    } catch (e) {
      loggerError('executeMailJob updateOne', e.message)
      return e
    }

    loggerError('executeMailJob', error.message)
    return error
  }
}

const moveMessageToAnotherProject = async (
  _,
  { projectId, sourceFolderId, targetProjectId },
  { models, user }
) => {
  try {

    const projectFound = await models.Project.findById(projectId, 'outlook columns')
    const targetProjectFound = await models.Project.findById(targetProjectId, 'columns')

    if (!projectFound) throw new ApolloError('project_not_found')
    if (!targetProjectFound) throw new ApolloError('target_project_not_found')

    const projectOutlook = projectFound.outlook || {}
    const accessToken = await projectOutlook.accessToken;
    const { refreshToken, accountId } = projectOutlook;

    const client = await getClientWithUpdateToken({
      projectId,
      models,
      accessToken,
      refreshToken
    })

    const folder = await getMailFolder(client, sourceFolderId)
    if (!folder) throw new ApolloError('folder_not_found')


    const folderMessages = await getFolderMessages(client, sourceFolderId)
    const folderImmutableMessages = await getFolderMessages(client, sourceFolderId, true)

    const messages = []

    for (const folderMessage of folderMessages) {
      const matchingImmutableMessage = folderImmutableMessages.find(m =>
        m['@odata.etag'] === folderMessage['@odata.etag']
      )
      messages.push({
        ...folderMessage,
        ...matchingImmutableMessage && {
          immutableId: matchingImmutableMessage.id,
          webLink: matchingImmutableMessage.webLink
        },
      })
    }

    loggerInfo('moveMessageToAnotherProject', { folder, accountId })
    const outlookIds = folderMessages.map(r => r.id)
    const immutOutlookIds = folderImmutableMessages.map(r => r.id)
    const changeKeys = folderMessages.map(r => r.changeKey)

    const mailsFound = await models.OutlookMail.find({
      $or: [
        { outlookId: { $in: [...outlookIds, ...immutOutlookIds] } },
        { changeKey: { $in: changeKeys } }
      ]
    })
    // const immutMailsFound = await models.OutlookMail.find({ outlookId: { $in: immutOutlookIds } })
    // const mailsFound = await models.OutlookMail.find({ outlookId: { $in: outlookIds } })
    // const changeKeyMailsFound = await models.OutlookMail.find({ changeKey: { $in: changeKeys } })

    // loggerInfo('moveMessageToAnotherProject', { mailsFound, })

    const outlookMailsToCreate = []
    const outlookMailsIdsToMove = []

    for (const message of messages) {
      // = messages.filter(m => {
      const messageInMailsFound = mailsFound.find(mail => mail.outlookId === message.id)
      const messageInImmutMailsFound = mailsFound.find(mail => mail.outlookId === message.immutableId)
      const messageInChangeKeyMailsFound = mailsFound.find(mail => mail.changeKey === message.changeKey)

      loggerInfo('moveMessageToAnotherProject', {
        booleans: {
          messageInMailsFound: Boolean(messageInMailsFound),
          messageInImmutMailsFound: Boolean(messageInImmutMailsFound),
          messageInChangeKeyMailsFound: Boolean(messageInChangeKeyMailsFound)
        }
      })

      if (messageInMailsFound || messageInImmutMailsFound || messageInChangeKeyMailsFound) {

        const mailId = messageInMailsFound && messageInMailsFound.id
        const immutMailId = messageInImmutMailsFound && messageInImmutMailsFound.id
        const changeKeyMailId = messageInChangeKeyMailsFound && messageInChangeKeyMailsFound.id

        const id = mailId || immutMailId || changeKeyMailId
        outlookMailsIdsToMove.push(id)

      } else {

        outlookMailsToCreate.push(
          formatMailFromOutlook(
            { ...message, id: message.immutableId || message.id },
            projectId,
            accountId
          )
        )

      }
    }


    const columnName = `Import ${folder.displayName}`
    const columnKey = columnName.toLowerCase().replace(/\s+/g, '');


    const targetProjectColumns = targetProjectFound.columns || []
    const targetProjectColumn = targetProjectColumns.find(c => c.key === columnKey)

    const columnId = targetProjectColumn
      ? targetProjectColumn._id
      : mongoose.Types.ObjectId()


    if (!targetProjectColumn) {

      let leastColPos = 0

      for (const col of targetProjectColumns) {
        const userPos = col.userColPositions.find(p => String(p.userId) === String(user.sub))
        const pos = userPos ? userPos.position : 0

        if (leastColPos < pos) {
          leastColPos = pos
        }
      }

      const nextPosOfCol = leastColPos ? leastColPos - 1 : 0

      await models.Project.updateOne(
        { _id: targetProjectId },
        {
          $push: {
            columns: {
              _id: columnId,
              key: columnKey,
              title: columnName,
              position: nextPosOfCol,
              userColPositions: [
                {
                  userId: user.sub,
                  position: nextPosOfCol
                }
              ]
            }
          },
        }
      )
    }

    let nextPosOfMail = 0


    const outlookMails = await models.OutlookMail.find(
      {
        columnKey: columnKey,
        projectId: targetProjectId,
      },
      'columnPosition columnKey'
    )


    const sortedOutlookMails = [...outlookMails]
      .sort((a, b) => a.columnPosition - b.columnPosition)
    const firstOutlookMail = sortedOutlookMails[0]
    const mailPosition = firstOutlookMail && firstOutlookMail.columnPosition
    nextPosOfMail = mailPosition ? mailPosition - 1 : 0


    loggerInfo('moveMessageToAnotherProject', {
      mailPosition,
      nextPosOfMail,
      columnId
    })

    const mailJobsToCreate = []

    const outlookMailBulkUpdateOps = []

    for (const id of outlookMailsIdsToMove) {
      outlookMailBulkUpdateOps.push({
        updateOne: {
          filter: { _id: mongoose.Types.ObjectId(id) },
          update: {
            projectId: mongoose.Types.ObjectId(targetProjectId),
            sourceProjectId: mongoose.Types.ObjectId(projectId),
            columnKey,
            columnPosition: nextPosOfMail,
            updatedAt: new Date()
          }
        }
      })
      const mail = mailsFound.find(mail => String(mail.id) === String(id))

      mailJobsToCreate.push({
        projectId: projectId,
        mailId: id,
        mailOutlookId: mail.outlookId,
        targetProjectId: targetProjectId,
        targetProjectColumId: columnId,
        status: MailJobStatus.PENDING,
        createdAt: new Date()
      })

      nextPosOfMail = nextPosOfMail - 1
    }

    const outlookMailToCreateWithPositions = []
    for (const mail of outlookMailsToCreate) {
      const mailId = mongoose.Types.ObjectId()

      outlookMailToCreateWithPositions.push({
        ...mail,
        _id: mailId,
        projectId: targetProjectId,
        sourceProjectId: projectId,
        columnKey,
        columnPosition: nextPosOfMail,
        createdAt: new Date()
      })

      mailJobsToCreate.push({
        projectId: projectId,
        mailId: mailId,
        mailOutlookId: mail.outlookId,
        targetProjectId: targetProjectId,
        targetProjectColumId: columnId,
        status: MailJobStatus.PENDING,
        createdAt: new Date()
      })

      nextPosOfMail = nextPosOfMail - 1
    }


    loggerInfo('moveMessageToAnotherProject', {
      outlookMailsToCreate,
      outlookMailsIdsToMove,
      columnName,
      columnKey,
      outlookMailToCreateWithPositions,
      outlookMailBulkUpdateOps: JSON.stringify(outlookMailBulkUpdateOps),
      mailJobsToCreate: JSON.stringify(mailJobsToCreate),
    })


    await models.OutlookMail.bulkWrite(outlookMailBulkUpdateOps)
    await models.OutlookMail.create(outlookMailToCreateWithPositions)
    await models.MailJob.create(mailJobsToCreate)

    return true

  } catch (error) {
    loggerError('moveMessageToAnotherProject', { error })
    return error
  }
}

const refreshMailSubscription = async (_, { projectId }, { models, user }) => {
  try {
    const projectFound = await models.Project.findById(
      projectId,
      'outlook outlookEmailColumnEnabled')
    if (!projectFound) throw new ApolloError('project_not_found')

    const outlookEmailColumnEnabled = projectFound.outlookEmailColumnEnabled

    const projectOutlook = projectFound.outlook || {}
    const accessToken = await projectOutlook.accessToken;
    const { refreshToken, accountId, syncMailEnabled } = projectOutlook;

    const client = await getClientWithUpdateToken({
      projectId,
      models,
      accessToken,
      refreshToken
    })
    loggerInfo({ syncMailEnabled, refreshToken })

    // step 1 
    // update exp date
    await updateOutlookMailSubscriptionExpiration(client, projectId, models)

    // step 2
    // create outlook mails
    if (syncMailEnabled) {
      // const oIds = new Set(["AAMkAGZjYzAyZjAyLTMyMDEtNDlhYS1hMDk3LWMyOTA1ZDFhYWRlMQBGAAAAAAB9cH2nn6GnQrrZ6CfmJcvgBwAkCZ2U9lCUSZ3WrQH4jiMIAAAAAAEMAAAkCZ2U9lCUSZ3WrQH4jiMIAAAi44LXAAA="])

      const inboxFolderName = 'Inbox';
      const inboxFolderNameGerman = 'Posteingang';

      let inboxFolder = await getMailFolderFilterName(client, inboxFolderName)

      if (!inboxFolder) {
        inboxFolder = await getMailFolderFilterName(client, inboxFolderNameGerman)
        if (!inboxFolder) throw new ApolloError('inbox_folder_not_found')
      }

      const inboxMails = await getFolderMessages(client, inboxFolder.id)

      const mails = formatMailsFromOutlook(inboxMails, projectId)

      const mailsOutlookIds = mails.map(m => m.outlookId)
      loggerInfo({
        mailsOutlookIds: JSON.stringify(mailsOutlookIds),
        inboxFolder: inboxFolder,
        inboxMails: inboxMails.length,
        mails: mails.length,
      })


      // const existingOutlookMailsOidInDB = await models.MailJobs.find()
      const existingOutlookMailsOidInDB = await models.OutlookMail.find(
        { outlookId: { $in: mailsOutlookIds } },
        'outlookId'
      )

      const existingMailsOids = new Set(existingOutlookMailsOidInDB.map(m => m.outlookId))

      const newOutlookMails = []
      let recipientsEmailAddresses = []
      // const recipientsEmailAddresses = newOutlookMail.toRecipients.map(r =>
      //   String(r.emailAddress.address).toLowerCase())

      for (const mail of mails) {
        const mailToRecipients = mail.toRecipients || []
        console.log({ mailToRecipients })

        recipientsEmailAddresses = new Set([
          ...recipientsEmailAddresses,
          ...mailToRecipients.map(r => String(r.emailAddress.address).toLowerCase())
        ])

        // push to mailOutlookMails if mail is not yet in the DB
        if (!existingMailsOids.has(mail.outlookId)) newOutlookMails.push(mail)
      }

      loggerInfo({
        recipientsEmailAddresses,
        newOutlookMailsLength: newOutlookMails.length
      })

      const rulesFound = await models.OutlookMailRule.find({
        accountId,
        targetEmailAddress: { $in: [...recipientsEmailAddresses] }
      })

      const rulesFoundTargetProjectIds = rulesFound.map(r => r.targetProjectId)

      const rulesFoundTargetProjectsFound = await models.Project.find(
        { _id: { $in: rulesFoundTargetProjectIds } },
        'selectedOutlookEmailsColumn'
      )

      const targetProjsSelectColKeys = rulesFoundTargetProjectsFound
        .filter(p => !!p.selectedOutlookEmailsColumn)
        .map(p => p.selectedOutlookEmailsColumn)

      const otlkMailsInColsFound = await models.OutlookMail.find(
        {
          columnKey: { $in: targetProjsSelectColKeys },
          projectId: { $in: rulesFoundTargetProjectIds },
        },
        'columnPosition columnKey projectId'
      )

      const outlookMailsToCreate = []
      const mailJobsToCreate = []

      for (const newOutlookMail of newOutlookMails) {

        const recipientsEmailAddresses = new Set(newOutlookMail.toRecipients.map(r =>
          String(r.emailAddress.address).toLowerCase()))

        const rules = rulesFound.filter(r => recipientsEmailAddresses.has(r.targetEmailAddress))
        // const rules = await models.OutlookMailRule.find({
        //   accountId,
        //   targetEmailAddress: { $in: recipientsEmailAddresses }
        // })
        loggerInfo({
          rules
        })
        // WARNING: if these codes needs to be updated or changed consider canging the code in refreshMailSubscription too
        if (rules.length <= 0 || !outlookEmailColumnEnabled) {
          // const existingMailInProject = hasExistingMail(projectId)
          // if (existingMailInProject) return 'Existing Mail'

          const mailId = mongoose.Types.ObjectId()

          outlookMailsToCreate.push({
            _id: mailId,
            ...newOutlookMail,
            columnKey: projectFound.selectedOutlookEmailsColumn,
          })
          // await models.OutlookMail.create({
          //   _id: mailId,
          //   ...newOutlookMail,
          //   columnKey: projectFound.selectedOutlookEmailsColumn,
          // })

          mailJobsToCreate.push({
            projectId: projectId,
            mailId: mailId,
            mailOutlookId: newOutlookMail.outlookId,
            targetProjectId: projectId,
            status: MailJobStatus.PENDING,
            createdAt: new Date()
          })
          // await models.MailJob.create({
          //   projectId: projectId,
          //   mailId: mailId,
          //   mailOutlookId: newOutlookMail.outlookId,
          //   targetProjectId: projectId,
          //   status: MailJobStatus.PENDING,
          //   createdAt: new Date()
          // })

        } else {

          const rulesTargetProjectIds = new Set(rules.map(r => String(r.targetProjectId)))

          const rulesTargetProjects = rulesFoundTargetProjectsFound
            .filter(tp => rulesTargetProjectIds.has(String(tp._id)))
          // const rulesTargetProjectsFound = await models.Project.find(
          //   { _id: { $in: rulesTargetProjectIds } },
          //   'selectedOutlookEmailsColumn'
          // )

          loggerInfo({ rulesTargetProjectIds, rulesTargetProjects })

          // const targetProjsSelectColKeys = rulesTargetProjects
          //   .filter(p => !!p.selectedOutlookEmailsColumn)
          //   .map(p => p.selectedOutlookEmailsColumn)

          // const outlookMails = await models.OutlookMail.find(
          //   {
          //     columnKey: { $in: targetProjsSelectColKeys },
          //     projectId: { $in: rulesTargetProjectIds },
          //   },
          //   'columnPosition columnKey'
          // )
          // const outlookMails = await models.OutlookMail.find(
          //   {
          //     columnKey: { $in: targetProjsSelectColKeys },
          //     projectId: { $in: rulesTargetProjectIds },
          //   },
          //   'columnPosition columnKey'
          // )

          for (const rule of rules) {
            const targetProjectFound = rulesTargetProjects.find(p =>
              String(p._id) === String(rule.targetProjectId))

            loggerInfo({ targetProjectFound })

            if (!targetProjectFound) loggerInfo('targetProjectFound not found', { projectId })
            else {

              // const existingMailInProject = hasExistingMail(rule.targetProjectId)

              // if (existingMailInProject) loggerInfo('Existing Mail')
              // else {
              const columnKey = targetProjectFound.selectedOutlookEmailsColumn

              const columnOutlookMails = otlkMailsInColsFound
                .filter(m =>
                  String(m.projectId) === String(rule.targetProjectId) &&
                  m.columnKey === columnKey)

              const sortedOutlookMails = [...columnOutlookMails]
                .sort((a, b) => (a.columnPosition || 0) - (b.columnPosition || 0))

              const firstOutlookMail = sortedOutlookMails[0]
              const mailPosition = firstOutlookMail && firstOutlookMail.columnPosition
              const nextPosition = mailPosition ? mailPosition - 1 : 0


              loggerInfo({
                columnKey,
                columnOutlookMails,
                sortedOutlookMails,
                firstOutlookMail,
                mailPosition,
                nextPosition,
              })

              const mailId = mongoose.Types.ObjectId()

              outlookMailsToCreate.push({
                _id: mailId,
                ...newOutlookMail,
                columnKey: columnKey,
                projectId: rule.targetProjectId,
                sourceProjectId: projectId,
                columnPosition: nextPosition
              })

              mailJobsToCreate.push({
                projectId: projectId,
                mailId: mailId,
                mailOutlookId: newOutlookMail.outlookId,
                // accountId: mail.accountId,
                targetProjectId: rule.targetProjectId,
                status: MailJobStatus.PENDING,
              })
              // }
            }
          }



        }
      }


      loggerInfo({
        outlookMailsToCreate: outlookMailsToCreate.length,
        mailJobsToCreate: mailJobsToCreate.length,
      })
      await models.OutlookMail.create(outlookMailsToCreate)
      await models.MailJob.create(mailJobsToCreate)


      // const updated = await models.OutlookMail.updateOne(
      //   {
      //     _id: mongoose.Types.ObjectId(omId)
      //     // outlookId: oIds[0]
      //   },
      //   {
      //     $set: {
      //       subject: "Get started with Microsoft 365 2",
      //       columnKey: "testing success",
      //     },
      //     $setOnInsert: { columnKey: "testing success" }
      //   },
      //   { upsert: true }
      // )

      // await models.OutlookMail.bulkWrite()
      // console.log({
      //   updated: JSON.stringify(updated)
      // })
      // await models.OutlookMail.insertMany(mails.map(mail => ({
      //   ...mail,
      //   columnKey: projectFound.selectedOutlookEmailsColumn
      // })))
    } else {
      return false;
    }

    return true
  } catch (error) {
    loggerError('refreshMailSubscription', error.message)
    return error
  }
}


module.exports = {
  createMailSubscription,
  recreateMailSubscription,
  deleteSubscription,
  updateSubscriptionExpiration,
  saveNewEmail,
  changeOutlookMailColumn,
  removeOutlookMailColumn,
  changeProjectDefaultOutlookMailsColumn,
  removeProjectDefaultOutlookMailsColumn,
  createMailJobTest,
  executeMailJob,
  moveMessageToAnotherProject,
  refreshMailSubscription
}