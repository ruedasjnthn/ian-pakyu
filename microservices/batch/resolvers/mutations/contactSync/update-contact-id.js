const { getClientWithUpdateToken } = require('../../../helper/AuthHelper');
const { deleteOutlookContact } = require('../../../helper/OutlookContactHelper');
const { getOutlookContactIdsToDeleteInOutlookContactFromAktenplatz } = require('../../../helper/ContactHelper');
const { loggerInfo } = require('../../../config/logger');

const updateProjectContactId = async (_, { projectId, contactId: newContactId }, { models }) => {
  try {
    const projectFound = await models.Project.findById(projectId, 'outlook')
    
    const project = projectFound && projectFound.outlook || {}
    const { contactId, accessToken, refreshToken } = project

    if (contactId !== newContactId) {

      await models.OutlookContactSync.deleteMany({ projectId })

      const updatedProject = await models.Project.updateOne(
        { _id: projectId },
        { 'outlook.contactId': newContactId }
      )

      const outlookIdsToDelete = await getOutlookContactIdsToDeleteInOutlookContactFromAktenplatz(
        models,
        projectId
      )

      const client = await getClientWithUpdateToken({ projectId, accessToken, models, refreshToken })

      for (const outlookId of outlookIdsToDelete) {
        const deleted = await deleteOutlookContact(
          client,
          outlookId
        )
        loggerInfo({ deleted })
      }

      if (outlookIdsToDelete && updatedProject.modifiedCount) {

        await models.Contact.bulkWrite([
          { deleteMany: { filter: { projectId: projectFound._id, fromOutlook: true } } },
          { updateMany: { filter: { projectId: projectFound._id }, update: { outlookId: null } } }
        ])

        await models.Issue.updateMany(
          { projectId },
          { $set: { "issueCustomFields.$[elem].outlookId": null } },
          { arrayFilters: [{ "elem.outlookId": { $ne: null } }] }
        )

        return 'updated_read_to_sync'

      }

    }

    return 'same_contact'
  }
  catch (e) {
    return e
  }
};

module.exports = {
  updateProjectContactId,
}
