const { clientGqlMutate } = require('./Helper/gqlClientHelper');
const { gql } = require('apollo-server-express');
const { Subscription } = require('./Helper/SubscriptionHelper');
const dayjs = require('dayjs');
const { loggerInfo, loggerError } = require('./config/logger')


async function renewSubscriptionExpirationDate() {
  try {
    const expiredSubsProjectIds = await Subscription.find(
      { expirationDateTime: { $lte: dayjs().add(1, 'day').toISOString() }, },
      { _id: 0, projectId: 1 }
    )

    loggerInfo({
      expiredSubsProjectIds,
      expirationDateTime: { "$lte": dayjs().add(1, 'day').toISOString() },
    })

    if (expiredSubsProjectIds.length) {
      await Promise.all(
        expiredSubsProjectIds.map(async ({ projectId }) => {

          let mutationObject = {
            mutation: gql`
              mutation updateSubscriptionExpiration($projectId: ID!) {
                updateSubscriptionExpiration(projectId: $projectId)
              }
            `,
            variables: {
              "projectId": projectId,
            },
          };

          const { data, errors } = await clientGqlMutate(mutationObject);
            loggerInfo('renewing subscription', projectId, {
            data,
            errors,
          });

        }),
      );
    }
  } catch (error) {
    loggerError(`Error saving to col_RestoreProjects:: `, { error });
  }
}

module.exports = renewSubscriptionExpirationDate;
