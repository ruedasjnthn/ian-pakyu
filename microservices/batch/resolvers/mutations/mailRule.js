const { ApolloError } = require("apollo-server-express");
const { loggerInfo, loggerError } = require("../../config/logger");

const createMailRule = async (_, { projectId, input }, { models }) => {
  try {
    const projectFound = await models.Project.findById(
      projectId,
      'outlook selectedOutlookEmailsColumn outlookEmailColumnEnabled'
    );

    if (!projectFound) throw new ApolloError('project_not_found')
    const outlook = projectFound.outlook


    const targetProjectFound = await models.Project.findById(
      input.targetProjectId,
      'selectedOutlookEmailsColumn outlookEmailColumnEnabled'
    );

    if (!targetProjectFound) throw new ApolloError('project_not_found')


    const createdMailRule = await models.OutlookMailRule.create({
      projectId,
      accountId: outlook.accountId,
      targetProjectId: input.targetProjectId,
      targetEmailAddress: String(input.targetEmailAddress).toLowerCase(),
    })


    const inputColEnabled = input.outlookEmailColumnEnabled
    const isColEnabledNotNull = inputColEnabled !== undefined && inputColEnabled !== null
    const shoulUpdateColEnabled = isColEnabledNotNull &&
      inputColEnabled !== targetProjectFound.outlookEmailColumnEnabled


    const inputColumnKey = input.targetProjectColumnKey
    const isColumnKeyNotNull = inputColumnKey !== undefined && inputColumnKey !== null
    const isColKeyDiff = isColumnKeyNotNull && inputColumnKey !== targetProjectFound.outlookEmailColumnEnabled
    const shouldUpdateColKey = (shoulUpdateColEnabled && inputColEnabled === false) ||
      isColKeyDiff

    const newColumnKey = (shoulUpdateColEnabled && inputColEnabled === false) ? null : inputColumnKey
    const prevColKey = targetProjectFound.selectedOutlookEmailsColumn

    await models.Project.updateOne(
      { _id: input.targetProjectId },
      {
        ...shouldUpdateColKey && {
          selectedOutlookEmailsColumn: newColumnKey,
        },
        ...shoulUpdateColEnabled && {
          outlookEmailColumnEnabled: inputColEnabled,
        },
        ...(shouldUpdateColKey || shoulUpdateColEnabled) && {
          updatedAt: new Date()
        }
      }
    )

    await models.OutlookMail.updateMany(
      {
        projectId: input.targetProjectId,
        columnKey: { $eq: prevColKey }
      },
      {
        columnKey: newColumnKey,
        updatedAt: new Date()
      }
    )

    const updatedTargetProjectFound = await models.Project.findById(
      input.targetProjectId,
      'selectedOutlookEmailsColumn outlookEmailColumnEnabled'
    );

    return ({
      id: createdMailRule.id,
      projectId: createdMailRule.projectId,
      accountId: createdMailRule.accountId,
      targetProjectId: createdMailRule.targetProjectId,
      targetEmailAddress: createdMailRule.targetEmailAddress,
      targetProjectColumnKey: updatedTargetProjectFound.selectedOutlookEmailsColumn,
      outlookEmailColumnEnabled: updatedTargetProjectFound.outlookEmailColumnEnabled,
    })

  } catch (error) {
    loggerError('!!ERROR createMailRule', { error })

    return error
  }
}

const createMailRules = async (_, { projectId, inputs }, { models }) => {
  try {
    const projectFound = await models.Project.findById(projectId, 'outlook');
    const outlook = projectFound.outlook

    const createdMailRules = await models.OutlookMailRule.create(inputs.map(input => ({
      projectId,
      accountId: outlook.accountId,
      targetProjectId: input.targetProjectId,
      targetEmailAddress: String(input.targetEmailAddress).toLowerCase(),
    })))

    return createdMailRules
  } catch (error) {
    loggerError('!!ERROR createMailRules', { error })

    return error
  }
}

const updateMailRule = async (_, { mailRuleId, input }, { models }) => {
  try {

    const targetProjectFound = await models.Project.findById(
      input.targetProjectId,
      'selectedOutlookEmailsColumn outlookEmailColumnEnabled'
    )
    if (!targetProjectFound) throw new ApolloError('project_not_found')

    const updatedMailRule = await models.OutlookMailRule.updateOne(
      {
        _id: mailRuleId
      }, {
      ...input.targetProjectId && {
        targetProjectId: input.targetProjectId,
      },
      ...input.targetEmailAddress && {
        targetEmailAddress: String(input.targetEmailAddress).toLowerCase(),
      },
    })

    const inputColEnabled = input.outlookEmailColumnEnabled
    const isColEnabledNotNull = inputColEnabled !== undefined && inputColEnabled !== null
    const shoulUpdateColEnabled = isColEnabledNotNull &&
      inputColEnabled !== targetProjectFound.outlookEmailColumnEnabled


    const inputColumnKey = input.targetProjectColumnKey
    const isColumnKeyNotNull = inputColumnKey !== undefined && inputColumnKey !== null
    const isColKeyDiff = isColumnKeyNotNull && inputColumnKey !== targetProjectFound.selectedOutlookEmailsColumn
    const shouldUpdateColKey = isColKeyDiff

    const newColumnKey = (shoulUpdateColEnabled && inputColEnabled === false) ? null : inputColumnKey


    // const prevSelectedOutlookEmailsColumn = targetProjectFound.selectedOutlookEmailsColumn;
    // const hasTargetColKeyValue = input.targetProjectColumnKey !== null
    //   && input.targetProjectColumnKey !== undefined

    // const isColumnDiff = hasTargetColKeyValue &&
    //   prevSelectedOutlookEmailsColumn !== input.targetProjectColumnKey

    // const prevOutlookEmailColumnEnabled = targetProjectFound.outlookEmailColumnEnabled;

    // const hasColEnabledValue = input.outlookEmailColumnEnabled !== null
    //   && input.outlookEmailColumnEnabled !== undefined

    // const isColEnabledDiff = hasColEnabledValue &&
    //   prevOutlookEmailColumnEnabled !== input.outlookEmailColumnEnabled

    // const newSelectedOutlookEmailsColumn = input.outlookEmailColumnEnabled === false
    //   ? null
    //   : input.outlookEmailColumnEnabled
    const prevColKey = targetProjectFound.selectedOutlookEmailsColumn

    loggerInfo({
      inputColEnabled,
      isColEnabledNotNull,
      shoulUpdateColEnabled,
      inputColumnKey,
      isColumnKeyNotNull,
      isColKeyDiff,
      shouldUpdateColKey,
      newColumnKey,
      prevColKey,
    })

    await models.Project.updateOne(
      { _id: input.targetProjectId },
      {
        ...shouldUpdateColKey && {
          selectedOutlookEmailsColumn: newColumnKey,
        },
        ...shoulUpdateColEnabled && {
          outlookEmailColumnEnabled: inputColEnabled,
        },
        ...(shouldUpdateColKey || shoulUpdateColEnabled) && {
          updatedAt: new Date()
        }
      }
    )

    if (shouldUpdateColKey)
      await models.OutlookMail.updateMany(
        {
          projectId: input.targetProjectId,
          columnKey: { $eq: prevColKey }
        },
        {
          columnKey: newColumnKey,
          updatedAt: new Date()
        }
      )

    // await models.OutlookMail.update({
    //   projectId:
    // }, {})


    return updatedMailRule.modifiedCount ? true : false
  } catch (error) {
    loggerError('!!ERROR updateMailRule', { error })

    return error
  }
}

const deleteMailRule = async (_, { mailRuleId }, { models }) => {
  try {
    // const projectFound = await models.Project.findById(projectId, 'outlook');
    // const outlook = projectFound.outlook

    await models.OutlookMailRule.deleteOne({
      _id: mailRuleId,
    })

    return true
  } catch (error) {
    loggerError('!!ERROR deleteMailRule', { error })
    return error
  }
}

module.exports = {
  createMailRule,
  createMailRules,
  updateMailRule,
  deleteMailRule
}