const { gql } = require('@apollo/client');
const { clientGqlMutate } = require('./Helper/gqlClientHelper');
const { Subscription } = require('./Helper/SubscriptionHelper')
const { loggerInfo, loggerError } = require('./config/logger')

const resubscribeExpiredMailSubs = async () => {
  try {
    const expiredSubs = await Subscription.find({
      expirationDateTime: { $lte: new Date() },
      resubscribed: { $ne: true }
    });
    await Subscription.updateMany({ _id: { $in: expiredSubs.map(s => s.id) } }, { resubscribing: true });

    const expiredSubsProjectIds = [...new Set(expiredSubs.map(s => String(s.projectId)))]

    loggerInfo({ expiredSubs, expiredSubsProjectIds })


    for (const projectId of expiredSubsProjectIds) {

      const mutationObject = {
        mutation: gql`
        mutation recreateMailSubscription($projectId: ID!) {
          recreateMailSubscription(projectId: $projectId)
        }
      `,
        variables: { "projectId": projectId },
      }

      const { data, errors } = await clientGqlMutate(mutationObject)
      loggerInfo('~~~~~~~~~ DONE SUBSCRIBE.', projectId, { data, errors })

      if (data && !errors) {
        await Subscription.updateMany(
          { projectId },
          { resubscribed: true, resubscribing: false, resubscribedAt: new Date() }
        );
      }

    }

  } catch (error) {
    loggerError('resubscribeExpiredMailSubs', { error })
    return error
  }
}

module.exports = {
  resubscribeExpiredMailSubs,
};