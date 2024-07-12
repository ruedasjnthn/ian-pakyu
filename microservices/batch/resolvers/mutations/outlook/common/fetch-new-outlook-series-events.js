const { getOccurrenceSeriesEventParts } = require('../../../../helper/OutlookEventHelper');
const mongoose = require('mongoose');
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, getOutlookSyncVars } = require('../../../../helper/OutlookSyncHelper');
const { OutlookCalendarSyncStatus } = require('../../../../constants/outlook-calendar');
const { getProjectCategories } = require('../../../../helper/CategoryHelper');
const { ApolloError } = require('apollo-server-express');


// note: this should be called more frequently
// sync newly created outlook series  
const fetchNewOutlookSeriesEvents = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.FETCHING_NEW_OUTLOOK_SERIES_EVENTS
    })


    const projectCategories = await getProjectCategories({ projectId })

    const outlookSyncAggregate = await models.OutlookSync.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(outlookSyncId)
        }
      },
      {
        $project: {
          newlyCreatedSeriesEvents: 1,
          recentlyCreatedSeriesMasterEventsOutlookIds: 1,
          newlyCreatedSeriesEventsToFetchNext: 1,
          isFirstSync: 1,
          masterSeriesEventsToUpdateInOlOutlookIds: 1
        }
      },
      {
        $set: {
          newlyCreatedSeriesEventsFetchCompleted: {
            "$filter": {
              "input": "$newlyCreatedSeriesEvents",
              "as": "newlyCreatedSeriesEvent",
              "cond": {
                $eq: [
                  "$$newlyCreatedSeriesEvent.fetchCompleted",
                  true
                ]
              }
            }
          }
        },
      },
      {
        $set: {
          newlyCreatedSeriesEventsFetchCompleted: {
            "$map": {
              "input": "$newlyCreatedSeriesEventsFetchCompleted",
              "as": "item",
              "in": "$$item.seriesMasterId",
            }
          }
        }
      },
      {
        $set: {
          seriesMastersOutlookIds: {
            "$cond": {
              "if": "$isFirstSync",
              "then": "$recentlyCreatedSeriesMasterEventsOutlookIds",
              "else": {
                "$concatArrays": [
                  { $ifNull: ["$recentlyCreatedSeriesMasterEventsOutlookIds", []] },
                  { $ifNull: ["$masterSeriesEventsToUpdateInOlOutlookIds", []] }
                ]
              }
            }
          }
        },
      },
      {
        $set: {
          fetchNotCompletedOutlookIds: {
            "$filter": {
              "input": "$seriesMastersOutlookIds",
              "as": "seriesMasterOutlookId",
              "cond": {
                $not: {
                  $in: [
                    "$$seriesMasterOutlookId",
                    { $ifNull: ["$newlyCreatedSeriesEventsFetchCompleted", []] }
                  ]
                }
              }
            }
          }
        }
      },
      {
        $set: {
          seriesMasterOutlookIdtoFetch: {
            $ifNull: [
              "$newlyCreatedSeriesEventsToFetchNext.seriesMasterOutlookId",
              { $first: "$fetchNotCompletedOutlookIds" }
            ]
          },
          seriesMasterOutlookIdToFetchNext: { $arrayElemAt: ["$fetchNotCompletedOutlookIds", 1] },
          nextLink: "$newlyCreatedSeriesEventsToFetchNext.nextLink"
        }
      },
      {
        $set: {
          isSmolIdInNewlyCreatedSeriesEvents: {
            "$toBool": {
              $first: {
                "$filter": {
                  "input": "$newlyCreatedSeriesEvents",
                  "as": "newlyCreatedSeriesEvent",
                  "cond": {
                    $eq: [
                      "$$newlyCreatedSeriesEvent.seriesMasterId",
                      "$seriesMasterOutlookIdtoFetch"
                    ]
                  },

                }
              }
            }
          }
        }
      },
      {
        $project: {
          seriesMasterOutlookIdtoFetch: 1,
          seriesMasterOutlookIdToFetchNext: 1,
          nextLink: 1,
          isSmolIdInNewlyCreatedSeriesEvents: 1,
          seriesMastersOutlookIds: 1,
          fetchNotCompletedOutlookIds: 1,
          newlyCreatedSeriesEventsFetchCompleted: 1,
          newlyCreatedSeriesEvents: 1,
          newlyCreatedSeriesEventsToFetchNext: 1,
          firstFetchNotCompletedOutlookIds: 1,
        }
      }
    ])

    const outlookSyncFound = outlookSyncAggregate && outlookSyncAggregate[0]
    if (!outlookSyncFound) throw new ApolloError('outlook_sync_not_found')

    const isSmolIdInNewlyCreatedSeriesEvents = Boolean(outlookSyncFound.isSmolIdInNewlyCreatedSeriesEvents)
    const seriesMasterOutlookIdtoFetch = outlookSyncFound.seriesMasterOutlookIdtoFetch
    const seriesMasterOutlookIdToFetchNext = outlookSyncFound.seriesMasterOutlookIdToFetchNext
    const nextLink = outlookSyncFound.nextLink

    loggerInfo('fetchNewOutlookSeriesEvents', {
      // outlookSyncAggregate,
      // outlookSyncFound,
      seriesMasterOutlookIdtoFetch,
      // seriesMasterOutlookIdToFetchNext,
      nextLink,
    })

    const seriesMasterId = seriesMasterOutlookIdtoFetch

    const masterEvent = await models.Event.findOne({
      projectId,
      deletedAt: null,
      outlookId: seriesMasterId
    });


    let newNextLink = null
    let occurenceEvents = []

    if (seriesMasterId && masterEvent) {
      const { client } = await getOutlookSyncVars({ models, projectId, })

      const {
        occurenceEvents: occEvents,
        newNextLink: nLink,
      } = await getOccurrenceSeriesEventParts({
        nextLink,
        seriesMasterId,
        projectCategories,
        client
      })

      newNextLink = nLink
      occurenceEvents = occEvents
    }

    const hasMoreToFetch = seriesMasterOutlookIdToFetchNext || newNextLink
    const isSeriesFetchCompleted = !Boolean(newNextLink)

    loggerInfo('fetchNewOutlookSeriesEvents', {
      newNextLink,
      isSeriesFetchCompleted,
      occurenceEventsL: occurenceEvents.length,
      seriesMasterId,
      masterEvent,
      hasMoreToFetch,
      isSmolIdInNewlyCreatedSeriesEvents
    })


    if (isSmolIdInNewlyCreatedSeriesEvents) {
      await models.OutlookSync.updateOne(
        {
          _id: outlookSyncId,
          "newlyCreatedSeriesEvents.seriesMasterId": seriesMasterId,
        },
        {
          "newlyCreatedSeriesEvents.$.fetchCompleted": isSeriesFetchCompleted,
          "$addToSet": {
            "newlyCreatedSeriesEvents.$.occurenceEvents": {
              $each: occurenceEvents
            }
          }
        })
    } else {
      await models.OutlookSync.updateOne(
        { _id: outlookSyncId },
        {
          ...(seriesMasterId && masterEvent) && {
            $addToSet: {
              newlyCreatedSeriesEvents: {
                seriesMasterId,
                occurenceEvents,
                fetchCompleted: isSeriesFetchCompleted
              },
            },
          }
        })
    }

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: hasMoreToFetch
          ? OutlookCalendarSyncStatus.READY_TO_FETCH_NEW_OUTLOOK_SERIES_EVENTS
          : OutlookCalendarSyncStatus.DONE_TO_FETCH_NEW_OUTLOOK_SERIES_EVENTS,
        updatedAt: new Date(),

        newlyCreatedSeriesEventsToFetchNext: {
          seriesMasterOutlookId: newNextLink ? seriesMasterId : seriesMasterOutlookIdToFetchNext,
          nextLink: newNextLink,
        },

      }
    );

    return outlookSyncId

  } catch (err) {
    loggerError('fetchNewOutlookSeriesEvents ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_FETCH_NEW_OUTLOOK_SERIES_EVENTS,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err
  }
}

module.exports = {
  fetchNewOutlookSeriesEvents,
}
