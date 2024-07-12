
const { OutlookContactSync } = require('../../Helper/OutlookContactSyncHelper')
const { OutlookSyncStatusTypes } = require('../../constants/outlook')
const { Project } = require('../../Helper/ProjectHelper')
const { loggerInfo, loggerError } = require('../../config/logger')
const moment = require('moment')

async function runSyncAllContacts() {
  try {

    const contEnabledProjs = await Project.find({ 'outlook.syncContactsEnabled': true }, 'id')
    const contEnabledProjIds = contEnabledProjs.map(p => p._id)

    loggerInfo('runSyncAllContacts', {
      contEnabledProjs,
      contEnabledProjIds,
    })

    // const ocsToSyncFound = await OutlookContactSync.find(
    //   {
    //     projectId: { $in: contEnabledProjIds },
    //     status: OutlookSyncStatusTypes.FAILED_SYNCING,
    //   },
    //   'status'
    // )

    const ocsToInitFound = await OutlookContactSync.find(
      {
        projectId: { $in: contEnabledProjIds },
        status: OutlookSyncStatusTypes.SUCCESS,
        $or: [
          { syncEndAt: null },
          { syncEndAt: { $lte: moment().subtract(1, 'minutes').toDate() }, }
        ]
      },
      'status'
    )

    // const ocsToSyncIds = ocsToSyncFound.map(ocs => ocs._id)
    const ocsToInitIds = ocsToInitFound.map(ocs => ocs._id)

    loggerInfo('runSyncAllContacts', {
      // ocsToSyncIds,
      ocsToInitIds,
    })


    // await OutlookContactSync.updateMany(
    //   { _id: { $in: ocsToSyncIds } },
    //   {
    //     status: OutlookSyncStatusTypes.READY_TO_SYNC,
    //     failedAt: null,
    //   },
    // );


    await OutlookContactSync.updateMany(
      { _id: { $in: ocsToInitIds } },
      {
        status: OutlookSyncStatusTypes.READY_TO_INITIALIZE,
        nextLink: null,
        failedAt: null,
        contacts: [],
        outlookContactIdsDeleted: [],
        outlookContactsUpdated: [],
      },
    );

  } catch (e) {
    loggerError('runSyncAllContacts ERROR: ', { e })
  }
}


module.exports = {
  runSyncAllContacts,
}
