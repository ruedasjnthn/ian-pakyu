const { ApolloError } = require("apollo-server-express")
const { loggerError } = require("../../config/logger")
const { UserRole } = require("../../constants/project")

const projectMailRules = async (_, { projectId }, { models }) => {
  try {
    const rules = await models.OutlookMailRule.find({
      projectId,
    })

    const targetProjectIds = rules.map(r => r.targetProjectId)

    const targetProjectsFound = await models.Project.find({
      _id: { $in: targetProjectIds }
    }, 'selectedOutlookEmailsColumn outlookEmailColumnEnabled')

    const getTargetColumnKey = (projId) => {
      const proj = targetProjectsFound.find(p => String(p.id) === String(projId))
      const isOutlookMailColumnEnabled = getOutlookMailColumnEnabled(projId)
      if (!isOutlookMailColumnEnabled) return null
      return proj && proj.selectedOutlookEmailsColumn
    }

    const getOutlookMailColumnEnabled = (projId) => {
      const proj = targetProjectsFound.find(p => String(p.id) === String(projId))
      return Boolean(proj && proj.outlookEmailColumnEnabled)
    }

    return rules.map(rule => ({
      id: rule.id,
      projectId: rule.projectId,
      accountId: rule.accountId,
      targetProjectId: rule.targetProjectId,
      targetEmailAddress: rule.targetEmailAddress,
      targetProjectColumnKey: getTargetColumnKey(rule.targetProjectId) || '',
      outlookEmailColumnEnabled: getOutlookMailColumnEnabled(rule.targetProjectId),
    }))

  } catch (error) {
    loggerError('~~!!ERROR! projectMailRules', { error })
    return error
  }
}

const mailRuleTargetProjOpts = async (_, { projectId }, { models, user }) => {
  try {
    // // check if user is owner
    // const ownerOfProject = await models.Project.findOne({
    //   _id: projectId,
    //   users: { $elemMatch: { userId: user.sub, role: UserRole.OWNER } }
    // })

    // if (!ownerOfProject) throw new ApolloError('not_owner_of_the_project')

    const projectsFound = await models.Project.find(
      {
        users: {
          $elemMatch: {
            userId: user.sub,
            role: { $in: [UserRole.OWNER, UserRole.ADMINISTRATOR] }
          }
        }
      },
      'name columns'
    )

    return projectsFound.map(p => ({
      label: p.name,
      value: p.id,
      columns: !p.columns ? [] : p.columns.map(c => ({
        label: c.title,
        value: c.key,
      }))
    }))

  } catch (error) {
    loggerError('~~!!ERROR! mailRuleTargetProjOpts', { error })
    return error
  }
}


module.exports = {
  projectMailRules,
  mailRuleTargetProjOpts
}