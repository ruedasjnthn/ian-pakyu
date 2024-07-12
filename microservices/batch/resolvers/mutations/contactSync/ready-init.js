const mongoose = require('mongoose');
const { ApolloError } = require('apollo-server-express');
const { OutlookSyncStatusTypes } = require('../../../constants/outlook');
const { loggerInfo, loggerError } = require('../../../config/logger');


const readyToInitializeContactSync = async (_, { projectId }, { models, user }) => {
  try {

    const ongoingSync = await models.OutlookContactSync.findOne(
      {
        projectId,
        status: {
          $in: [
            OutlookSyncStatusTypes.READY_TO_INITIALIZE,
            OutlookSyncStatusTypes.READY_TO_SYNC,
            OutlookSyncStatusTypes.PENDING,
            OutlookSyncStatusTypes.INITIALIZING,
            OutlookSyncStatusTypes.SYNCING,
          ]
        },
      },
      'status'
    )

    if (ongoingSync) throw new ApolloError('there is a contact sync sync_currently')

    // // check if there is a project  with the same contact sync
    // const projectFound = await models.Project.findById(projectId, 'outlook')
    // if (projectFound.outlook && projectFound.outlook.contactId) {

    //   const exisitingContactSync = await models.OutlookSync.findOne(
    //     {
    //       projectId: { $not: { $eq: projectId } },
    //       contactId: projectFound.outlook.contactId
    //     },
    //     'status'
    //   )
    //   loggerInfo({ exisitingContactSync })
    //   if (exisitingContactSync) throw new ApolloError('contact already synced in another project')
    // } else throw new ApolloError('Select contact first')

    const outlookContactSyncFound = await models.OutlookContactSync.findOne(
      { projectId },
      'status'
    )

    if (outlookContactSyncFound) {
      let updateData = outlookContactSyncFound.status === OutlookSyncStatusTypes.FAILED_SYNCING
        ? { status: OutlookSyncStatusTypes.READY_TO_SYNC }
        : {
          status: OutlookSyncStatusTypes.READY_TO_INITIALIZE,
          nextLink: null,
          contacts: [],
          outlookContactIdsDeleted: [],
          outlookContactsUpdated: [],
        };


      await models.OutlookContactSync.updateOne(
        { _id: outlookContactSyncFound._id },
        {
          ...updateData,
          failedAt: null,
        }
      )

      loggerInfo({ outlookContactSyncFound })
      return outlookContactSyncFound._id

    } else {
      const outlookSyncId = mongoose.Types.ObjectId()
      await models.OutlookContactSync.create({
        _id: outlookSyncId,
        projectId,
        status: OutlookSyncStatusTypes.READY_TO_INITIALIZE,
        createdAt: new Date(),
        userId: user.sub,
      })
      return outlookSyncId
    }

  } catch (e) {
    loggerError('ERROR: readyToInitializeContactSync, ', { e })
    return e
  }
}

module.exports = {
  readyToInitializeContactSync,
}
