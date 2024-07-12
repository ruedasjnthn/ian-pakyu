const { getClientWithUpdateToken } = require("./AuthHelper")
const mongoose = require('mongoose')
const { ApolloError } = require("apollo-server-express")
const { defaultTimeZone } = require("../constants/calendar")
const { OutlookCalendarSyncStatus } = require("../constants/outlook-calendar")

const updateOutlookSyncStatusHelper = async ({ status, models, outlookSyncId }) => {
  // const outlookSyncFound = await models.OutlookSync.findById(outlookSyncId, 'status')

  await models.OutlookSync.updateOne(
    { _id: outlookSyncId },
    {
      status,
      updatedAt: new Date(),
      ...(status === OutlookCalendarSyncStatus.SYNCING_DELETED_EVENTS
        || status === OutlookCalendarSyncStatus.SYNCING_ISSUE_EVENTS) && {
        syncStartAt: new Date()
      }
    }
  )
}

const getOutlookSyncVars = async ({ models, projectId, }) => {
  const projectFound = await models.Project.findById(projectId, 'outlook timeZone prefixes')
  if (!projectFound) throw new ApolloError('project_not_found')

  const projectOutlook = projectFound.outlook || {}
  const timeZone = projectFound.timeZone || defaultTimeZone
  const projectPrefixes = projectFound.prefixes || []


  // get client object for ms-graph
  const { accessToken, refreshToken, calendarId } = projectOutlook
  const tokens = { accessToken, refreshToken }
  const client = await getClientWithUpdateToken({ accessToken, refreshToken, models, projectId })

  const outlookCalendarId = calendarId

  // get project prefixes
  const sortedProjectPrefixes = [...projectPrefixes]
    .sort((a, b) => (a.position - b.position))

  const prefixesFieldIds = sortedProjectPrefixes
    .filter(p => p.fieldId)
    .map(p => mongoose.Types.ObjectId(p.fieldId))

  return {
    client,
    timeZone,
    projectPrefixes,
    outlookCalendarId,
    prefixesFieldIds,
    sortedProjectPrefixes,
    accessToken,
    refreshToken,
    tokens
  }
}

const getOutlookSyncVarsNoClient = async ({ models, projectId, }) => {
  const projectFound = await models.Project.findById(projectId, 'outlook timeZone prefixes')
  if (!projectFound) throw new ApolloError('project_not_found')

  const projectOutlook = projectFound.outlook || {}
  const timeZone = projectFound.timeZone || defaultTimeZone
  const projectPrefixes = projectFound.prefixes || []


  // get client object for ms-graph
  const { accessToken, refreshToken, calendarId } = projectOutlook
  const tokens = { accessToken, refreshToken }

  const outlookCalendarId = calendarId

  // get project prefixes
  const sortedProjectPrefixes = [...projectPrefixes]
    .sort((a, b) => (a.position - b.position))

  const prefixesFieldIds = sortedProjectPrefixes
    .filter(p => p.fieldId)
    .map(p => mongoose.Types.ObjectId(p.fieldId))

  return {
    timeZone,
    projectPrefixes,
    outlookCalendarId,
    prefixesFieldIds,
    sortedProjectPrefixes,
    accessToken,
    refreshToken,
    tokens
  }
}

const getClientForCalendarSync = async ({
  models,
  projectId,
  tokens = {
    accessToken: null,
    refreshToken: null,
  }
}) => {
  const { accessToken, refreshToken } = tokens
  const client = await getClientWithUpdateToken({ accessToken, refreshToken, models, projectId })
  return client
}

const getMsGraphClient = async (client, models, projectId) => {
  if (client) return client

  const { client: clt } = await getOutlookSyncVars({ models, projectId })
  return clt
}

const getProjectCustomFields = async ({ models, projectId }) => {

  const projectCustomFieldsFound = await models.CustomField.find({
    projectId,
    type: { $in: ['checkbox', 'date'] },
  });

  const dateCustomFieldsFound = projectCustomFieldsFound.filter(f => f.type === 'date')
  const dateCustomFieldsIds = await dateCustomFieldsFound.map(cf => mongoose.Types.ObjectId(cf._id))

  const checkboxCustomFieldsFound = projectCustomFieldsFound.filter(f => f.type === 'checkbox')
  const checkboxCustomFieldsIds = checkboxCustomFieldsFound.map(f => f._id)

  const hiddenDateCustomFieldsFound = dateCustomFieldsFound.filter(f => f.hideFromCalendar)
  const hiddenDateCustomFieldsIds = hiddenDateCustomFieldsFound.map(cf => mongoose.Types.ObjectId(cf._id))

  const shownDateCustomFields = dateCustomFieldsFound.filter(f => !f.hideFromCalendar)
  const shownDateCustomFieldIds = shownDateCustomFields.map(cf => mongoose.Types.ObjectId(cf._id))

  return {
    projectCustomFieldsFound,
    dateCustomFieldsFound,
    dateCustomFieldsIds,
    checkboxCustomFieldsFound,
    checkboxCustomFieldsIds,
    hiddenDateCustomFieldsFound,
    hiddenDateCustomFieldsIds,
    shownDateCustomFieldIds,
  }
}

module.exports = {
  updateOutlookSyncStatusHelper,
  getOutlookSyncVars,
  getProjectCustomFields,
  getClientForCalendarSync,
  getOutlookSyncVarsNoClient,
  getMsGraphClient
}