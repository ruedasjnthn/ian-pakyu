require('isomorphic-fetch');
const mongoose = require('mongoose');
const { loggerLog, loggerError, loggerInfo } = require('../config/logger');

const formatMailFromOutlook = (mail, projectId, accountId) => {
  const { createdDateTime } = mail;
  return {
    projectId: mongoose.Types.ObjectId(projectId),
    bccRecipients: mail.bccRecipients,
    ccRecipients: mail.ccRecipients,
    from: mail.from,
    sender: mail.sender,
    replyTo: mail.replyTo,
    toRecipients: mail.toRecipients,
    body: mail.body,
    bodyPreview: mail.bodyPreview,
    categories: mail.categories,
    hasAttachments: mail.hasAttachments,
    importance: mail.importance,
    isRead: mail.isRead,
    subject: mail.subject,
    webLink: mail.webLink,
    createdAt: new Date(createdDateTime),
    parentFolderId: mail.parentFolderId,
    lastModifiedDateTime: mail.lastModifiedDateTime,
    receivedDateTime: mail.receivedDateTime,
    sentDateTime: mail.sentDateTime,
    fromOutlook: true,
    outlookId: mail.id,
    accountId,
    changeKey: mail.changeKey,
  };
};
const formatMailsFromOutlook = (mails, projectId) =>
  mails.map((mailItem) => formatMailFromOutlook(mailItem, projectId));

const getOutlookMails = async (client, projectId) => {
  let mails = [];
  const results = await client.api(`/me/messages?$top=100`).get();
  mails = results && results.value || [];
  let nextLink = results['@odata.nextLink'];

  while (nextLink) {
    const nextResults = await client.api(nextLink).get();
    mails = [...mails, ...nextResults ? nextResults.value : []];
    nextLink = nextResults['@odata.nextLink'];
  }
  loggerInfo({ length: mails.length });
  return formatMailsFromOutlook(mails, projectId);
  // try {
  //   let mails = [];
  //   loggerInfo('...fetching mails')
  //   const results = await client.api(`/me/messages?$top=120`).get();
  //   loggerInfo({ results });

  //   mails = results && results.value || [];
  //   let nextLink = results['@odata.nextLink'];

  //   loggerInfo({ mails, nextLink });

  //   while (nextLink) {
  //     const nextResults = await client.api(nextLink).get();
  //     loggerInfo({ nextResults });

  //     mails = [...mails, ...nextResults ? nextResults.value : []];
  //     nextLink = nextResults['@odata.nextLink'];
  //   }
  //   loggerInfo({ length: mails.length });
  //   return formatMailsFromOutlook(mails, projectId);
  // } catch (e) {
  //   return []
  // }
};

const getOutlookMail = async (client, projectId, messageId) => {
  try {
    const mail = await client.api(`/me/messages/${messageId}`).get();

    if (!mail) {
      loggerError('~~!ERROR! getOutlookMail mail is null')
      return null
    }
    const dataContext = mail["@odata.context"]

    // get accountId
    let accountId;
    const dataContextParts = dataContext.split("'");
    if (dataContextParts[0] === 'https://graph.microsoft.com/v1.0/$metadata#users(') {
      accountId = dataContextParts[1]
    }

    return formatMailFromOutlook(mail, projectId, accountId);
  } catch (e) {
    loggerError('~~!ERROR! getOutlookMail', { e })
    return null
  }
};

const deleteOutlookMailSubscription = async (client, projectId, models) => {
  try {
    const subscription = await models.Subscription.findOne(
      { projectId },
      'subscriptionId',
    );

    if (subscription && subscription !== null) {
      await client
        .api(`/subscriptions/${subscription.subscriptionId}`)
        .delete();
      await models.Subscription.deleteOne({ projectId });
    }
    return true;
  } catch (error) {
    loggerError({ error });
    return false;
  }
};

const updateOutlookMailSubscriptionExpiration = async (
  client,
  projectId,
  models,
) => {
  try {
    const subscription = await models.Subscription.findOne(
      { projectId },
      'subscriptionId',
    );
    const expiration = {
      expirationDateTime: new Date(Date.now() + 253800000).toISOString(),
    };

    if (subscription && subscription !== null) {
      const subs = await client
        .api(`/subscriptions/${subscription.subscriptionId}`)
        .update(expiration);
      loggerInfo({ subs });

      if (!subs) return false

      await models.Subscription.updateOne(
        { projectId },
        { ...expiration, subsUpdatedAt: new Date() }
      );

    }
    return true;
  } catch (error) {
    loggerInfo({ error });
    return false;
  }
};

const moveMessageFolder = async (client, messageId, destinationId) => {
  try {
    loggerInfo('moveMessageFolder', { messageId, destinationId })

    const response = await client.api(`/me/messages/${messageId}/move`)
      .header("Prefer", "IdType=\"ImmutableId\"")
      .post({
        destinationId: destinationId
      })

    loggerInfo('moveMessageFolder', { response })
    return response
  } catch (error) {
    loggerError('moveMessageFolder', error.message)
    return null
  }
}

module.exports = {
  formatMailFromOutlook,
  formatMailsFromOutlook,
  getOutlookMails,
  getOutlookMail,
  deleteOutlookMailSubscription,
  updateOutlookMailSubscriptionExpiration,
  moveMessageFolder
};
