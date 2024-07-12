const { getEventInOutlookBatch, } = require('../../../../helper/OutlookEventHelper');
const mongoose = require('mongoose');
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, getOutlookSyncVars, getProjectCustomFields } = require('../../../../helper/OutlookSyncHelper');
const { OutlookCalendarSyncStatus, CalendarSyncLimit } = require('../../../../constants/outlook-calendar');
const { ApolloError } = require('apollo-server-express');
const { CalendarSyncRange, CalendarRangeFilter } = require('../../../../constants/outlook');

// limit of issue to process
const maxLimit = CalendarSyncLimit.EVENT_LIMIT

// sync deleted events 
const syncDeletedEvents = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.SYNCING_DELETED_EVENTS
    })

    const { dateCustomFieldsIds, } = await getProjectCustomFields({ models, projectId })

    const outlookSyncAggregate = await models.OutlookSync.aggregate([
      { $match: { _id: mongoose.Types.ObjectId(outlookSyncId) } },
      {
        "$set": {
          eventsOutlookIdsToCheckIfDeleted: {
            "$filter": {
              "input": "$recentlyCreatedEventsOutlookIds",
              "as": "recentlyCreatedEventsOutlookId",
              "cond": {
                $not: {
                  $in: [
                    "$$recentlyCreatedEventsOutlookId",
                    {
                      "$ifNull": [
                        "$checkedDeletedRecentlyCreatedEventsOutlookIds",
                        []
                      ]
                    }
                  ]
                }
              },

            }
          }
        }
      },
      {
        "$set": {
          issueEventsOutlookIdsToCheckIfDeleted: {
            "$filter": {
              "input": "$recentlyCreatedIssueEventsOutlookIds",
              "as": "recentlyCreatedIssueEventsOutlookId",
              "cond": {
                $not: {
                  $in: [
                    "$$recentlyCreatedIssueEventsOutlookId",
                    {
                      "$ifNull": [
                        "$checkedDeletedRecentlyCreatedEventsOutlookIds",
                        []
                      ]
                    }
                  ]
                }
              },

            }
          }
        }
      },
      {
        $set: {
          eventsOutlookIdsToCheckIfDeleteLength: {
            "$size": {
              "$ifNull": [
                "$eventsOutlookIdsToCheckIfDeleted",
                []
              ]
            }
          },
          issueEventsOutlookIdsToCheckIfDeleteLength: {
            "$size": {
              "$ifNull": [
                "$issueEventsOutlookIdsToCheckIfDeleted",
                []
              ]
            }
          }
        }
      },
      {
        $set: {
          hasMoreToCheck: {
            $or: [
              {
                $gt: [
                  "$eventsOutlookIdsToCheckIfDeleteLength",
                  maxLimit
                ]
              },
              {
                $gt: [
                  "$issueEventsOutlookIdsToCheckIfDeleteLength",
                  maxLimit
                ]
              },

            ]
          }
        }
      },
      {
        "$project": {
          eventsOutlookIdsToCheckIfDeleted: {
            "$slice": [
              "$eventsOutlookIdsToCheckIfDeleted",
              maxLimit
            ],

          },
          issueEventsOutlookIdsToCheckIfDeleted: {
            "$slice": [
              "$issueEventsOutlookIdsToCheckIfDeleted",
              maxLimit
            ],

          },
          hasMoreToCheck: 1,
        }
      }
    ])

    const outlookSyncFound = outlookSyncAggregate && outlookSyncAggregate[0]
    if (!outlookSyncFound) throw new ApolloError('outlook_sync_not_found')

    const eventsOutlookIdsToCheckIfDeleted = outlookSyncFound.eventsOutlookIdsToCheckIfDeleted || []
    const issueEventsOutlookIdsToCheckIfDeleted = outlookSyncFound.issueEventsOutlookIdsToCheckIfDeleted || []
    const hasMoreToCheck = outlookSyncFound.hasMoreToCheck

    const hasEventOutlookIdsToCheck = eventsOutlookIdsToCheckIfDeleted.length > 0
    const hasIssueEventOutlookIdsToCheck = issueEventsOutlookIdsToCheckIfDeleted.length > 0

    // check outlookId if it still exist in outlook if not add to events to remove
    const deletedEventsOutlookIds = []
    const deletedIssueEventsOutlookIds = []
    const checkedOutlookIds = []


    if (hasEventOutlookIdsToCheck || hasIssueEventOutlookIdsToCheck) {

      const { client } = await getOutlookSyncVars({ models, projectId, })

      if (hasEventOutlookIdsToCheck) {
        const eventsResults = await getEventInOutlookBatch(client, eventsOutlookIdsToCheckIfDeleted)
        for (const event of eventsResults) {
          const eventOutlookId = event.outlookId
          const eventNotFound = event.eventNotFound

          // if it is not found or the event returned is false then delete in db
          if (eventNotFound) {
            deletedEventsOutlookIds.push(eventOutlookId)
          }
          // do not do anything it means outlook event still exist

          checkedOutlookIds.push(eventOutlookId)
        }
      }


      // check outlookId if it still exist in outlook if not add to events to remove
      if (hasIssueEventOutlookIdsToCheck) {

        const issueEventsResults = await getEventInOutlookBatch(client, issueEventsOutlookIdsToCheckIfDeleted)
        for (const issueEvent of issueEventsResults) {
          const eventOutlookId = issueEvent.outlookId
          const eventNotFound = issueEvent.eventNotFound

          // if it is not found or the event returned is false then delete in db
          if (eventNotFound) {
            deletedIssueEventsOutlookIds.push(eventOutlookId)
          }
          // do not do anything it means outlook event still exist

          checkedOutlookIds.push(eventOutlookId)
        }
      }
    }

    loggerInfo({
      deletedEventsOutlookIds,
      deletedIssueEventsOutlookIds
    })

    if (deletedEventsOutlookIds.length > 0) {
      const masterEventsFromDb = await models.Event.find(
        {
          projectId,
          outlookId: { $in: deletedEventsOutlookIds },
          ...CalendarRangeFilter
        },
        'id'
      )
      const masterEventIdsToDelete = masterEventsFromDb.map(e => String(e._id))

      await models.Event.updateMany(
        {
          projectId,
          outlookId: { $in: deletedEventsOutlookIds },
          ...CalendarRangeFilter
        },
        {
          deletedAt: new Date(),
        }
      )

      if (masterEventIdsToDelete.length > 0) {
        // update events deletedAt
        await models.Event.updateMany(
          {
            projectId,
            $and: [
              {
                $or: [
                  { seriesMasterId: { $in: deletedEventsOutlookIds } },
                  { seriesMasterId: { $in: masterEventIdsToDelete } },
                ],
              },
              { ...CalendarRangeFilter }
            ]
          },
          {
            deletedAt: new Date(),
          }
        )
      }
    }

    if (deletedIssueEventsOutlookIds.length > 0)
      await models.Issue.updateMany(
        {
          projectId: mongoose.Types.ObjectId(projectId),
          issueCustomFields: {
            $elemMatch: {
              fieldId: { $in: dateCustomFieldsIds },
              outlookId: { $in: deletedIssueEventsOutlookIds },
              $and: [
                { value: { $gte: CalendarSyncRange.getStart() } },
                { value: { $lte: CalendarSyncRange.getEnd() } }
              ]
            }
          }
        },
        { $set: { "issueCustomFields.$.outlookId": null } }
      );

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        ...hasMoreToCheck ? {
          status: OutlookCalendarSyncStatus.READY_TO_SYNC_DELETED_EVENTS,
        } : {
          status: OutlookCalendarSyncStatus.DONE_TO_SYNC_DELETED_EVENTS,
          recentlyCreatedEventsOutlookIds: [],
          recentlyCreatedIssueEventsOutlookIds: []
        },
        $addToSet: {
          checkedDeletedRecentlyCreatedEventsOutlookIds: { $each: checkedOutlookIds },
        },
        updatedAt: new Date(),
      });

    return outlookSyncId

  } catch (err) {
    loggerError('syncDeletedEvents ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_SYNC_DELETED_EVENTS,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err

  }
}

module.exports = {
  syncDeletedEvents,
}
