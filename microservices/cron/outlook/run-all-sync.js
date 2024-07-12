
const { OutlookSync } = require('../Helper/OutlookSyncHelper')
const { Project } = require('../Helper/ProjectHelper')
const { OutlookSyncStatusTypes } = require('../constants/outlook')
const moment = require('moment');
const { loggerInfo, loggerError } = require('../config/logger')

async function runAllProjectOutlookSync() {
  try {
    const calEnabledProjs = await Project.find({ 'outlook.syncCalendarEnabled': true })
    const calEnabledProjIds = calEnabledProjs.map(p => p._id)

    // const osToInitFound = await OutlookSync.find({
    //   started: false,
    //   finished: true,
    //   status: {
    //     $in: [
    //       OutlookSyncStatusTypes.SUCCESS,
    //       OutlookSyncStatusTypes.FAILED_INITIALIZING,
    //       OutlookSyncStatusTypes.FAILED_SYNCING
    //     ]
    //   },
    //   projectId: { $in: calEnabledProjIds },
    //   calendarId: { $not: { $eq: null } },
    //   $or: [
    //     { syncEndAt: null },
    //     {
    //       syncEndAt: {
    //         $lte: moment().subtract(1, 'minutes').toDate()
    //       },
    //     }
    //   ]
    // })

    // await OutlookSync.updateMany(
    //   { _id: { $in: osToInitFound } },
    //   {
    //     status: OutlookSyncStatusTypes.READY_TO_INITIALIZE,
    //     nextLink: null,
    //     failedAt: null,
    //     events: [],
    //     outlookEventIdsDeleted: [],
    //     singleEventsUpdated: [],
    //     seriesMasterEvents: [],
    //     seriesOccurrenceEvents: [],
    //     recentlyCreatedSeriesMasterEventsOutlookIds: [],
    //     isFirstBatchInit: true,
    //   },
    // );

    const osToSyncFound = await OutlookSync.find({
      status: OutlookSyncStatusTypes.FAILED_SYNCING,
      projectId: { $in: calEnabledProjIds },
      calendarId: { $not: { $eq: null } }
    })

    const osToInitFound = await OutlookSync.find({
      started: false,
      finished: true,
      status: {
        $in: [
          OutlookSyncStatusTypes.SUCCESS,
          OutlookSyncStatusTypes.FAILED_INITIALIZING,
        ]
      },
      projectId: { $in: calEnabledProjIds },
      calendarId: { $not: { $eq: null } },
      $or: [
        { syncEndAt: null },
        {
          syncEndAt: {
            $lte: moment().subtract(1, 'minutes').toDate()
          },
        }
      ]
    })

    loggerInfo({
      'syncEndAt$lte:': moment().subtract(1, 'minutes').toDate()
    })

    await OutlookSync.updateMany(
      { _id: { $in: osToSyncFound } },
      {
        status: OutlookSyncStatusTypes.READY_TO_SYNC,
        failedAt: null,
      },
    );

    await OutlookSync.updateMany(
      { _id: { $in: osToInitFound } },
      {
        status: OutlookSyncStatusTypes.READY_TO_INITIALIZE,
        nextLink: null,
        failedAt: null,
        events: [],
        outlookEventIdsDeleted: [],
        singleEventsUpdated: [],
        seriesMasterEvents: [],
        seriesOccurrenceEvents: [],
        recentlyCreatedSeriesMasterEventsOutlookIds: [],
        isFirstBatchInit: true,
      },
    );

  } catch (e) {
    loggerError('ERROR: runSyncAllCalendars', { e })
  }
}


module.exports = {
  runAllProjectOutlookSync,
}
