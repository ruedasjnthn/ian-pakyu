const { updateOutlookEvent, } = require('../../../../helper/OutlookEventHelper');
const mongoose = require('mongoose');
const { getAggregateOpsEventDuration, formatIssueEventToOutlook, getAggregateOpsEventPrefixTitle, } = require('../../../../helper/EventHelper');
const { CalendarLogActionTypes } = require('../../../../constants/calendar');
const { loggerInfo, loggerError } = require('../../../../config/logger');
const { updateOutlookSyncStatusHelper, getProjectCustomFields, getOutlookSyncVarsNoClient, getClientForCalendarSync } = require('../../../../helper/OutlookSyncHelper');
const { OutlookCalendarSyncStatus, CalendarSyncLimit } = require('../../../../constants/outlook-calendar');
const { getProjectCategories } = require('../../../../helper/CategoryHelper');
const { syncEventsInCalUpdLogs } = require('../../calendarUpdateLogs');
const { ApolloError } = require('apollo-server-express');
const { CalendarSyncRange } = require('../../../../constants/outlook');

const maxLimit = CalendarSyncLimit.ISSUE_EVENT_LIMIT
// limit of issue to process
const getLimit = (customFieldsLength) => customFieldsLength > 0
  ? Math.ceil(maxLimit / customFieldsLength)
  : maxLimit

const getHasMoreIssueEvents = async ({ models, issueEventsFilter, limit }) => {
  const issueEventsCount = await models.Issue.aggregate([
    { $match: issueEventsFilter },
    { $count: 'totalCount' }
  ])

  const totalCount = issueEventsCount && issueEventsCount[0]
    ? issueEventsCount[0].totalCount
    : 0

  const hasMore = totalCount > limit

  return hasMore
}


// sync issues 
const syncUpdatedIssueEvents = async (_, { outlookSyncId, projectId }, { models }) => {
  try {
    await updateOutlookSyncStatusHelper({
      models,
      outlookSyncId,
      status: OutlookCalendarSyncStatus.SYNCING_UPDATED_ISSUE_EVENTS
    })

    const {
      tokens,
      prefixesFieldIds,
      timeZone,
      projectPrefixes
    } = await getOutlookSyncVarsNoClient({
      models,
      projectId,
    })

    const {
      checkboxCustomFieldsIds,
      dateCustomFieldsIds,
      dateCustomFieldsFound,
      shownDateCustomFieldIds
    } = await getProjectCustomFields({ models, projectId })

    const aggregateOpsPrefixTitle = getAggregateOpsEventPrefixTitle({ prefixesFieldIds, projectPrefixes })

    const aggregateOpsEventDuration = getAggregateOpsEventDuration({
      projectCheckBoxFieldsIds: checkboxCustomFieldsIds,
      projectDateCustomFields: dateCustomFieldsFound
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
          singleEventsUpdated: 1,
          lastSyncInitStartAt: 1,
          syncedUpdatedIssueEventsIds: 1,
        }
      },
      {
        $set: {
          singleEventsUpdatedOutlookIds: {
            "$map": {
              "input": "$singleEventsUpdated",
              "as": "singleEventsUpdated",
              "in": "$$singleEventsUpdated.outlookId"
            }
          }
        }
      },
      {
        $project: {
          singleEventsUpdatedOutlookIds: 1,
          lastSyncInitStartAt: 1,
          syncedUpdatedIssueEventsIds: 1
        }
      }
    ])

    const outlookSyncFound = outlookSyncAggregate && outlookSyncAggregate[0]
    if (!outlookSyncFound) throw new ApolloError('outlook_sync_not_found')

    const lastSyncInitStartAt = outlookSyncFound.lastSyncInitStartAt || []
    const singleEventsUpdatedOutlookIds = outlookSyncFound.singleEventsUpdatedOutlookIds || []
    const syncedUpdatedIssueEventsIds = outlookSyncFound.syncedUpdatedIssueEventsIds || []


    const limit = getLimit(dateCustomFieldsFound.length)

    const issueEventsFilter = {
      projectId: mongoose.Types.ObjectId(projectId),
      // 'issueCustomFields.fieldId': { $in: dateCustomFieldsIds },
      $or: [
        { updatedAt: { $gte: lastSyncInitStartAt }, },
        { updatedPrefixAt: { $gte: lastSyncInitStartAt }, }
      ],
      _id: { $nin: syncedUpdatedIssueEventsIds },
      issueCustomFields: {
        $elemMatch: {
          fieldId: { $in: shownDateCustomFieldIds, },
          $and: [
            { value: { $gte: CalendarSyncRange.getStart() } },
            { value: { $lte: CalendarSyncRange.getEnd() } }
          ]
        }
      }
    }


    const updatedIssuesFound = await models.Issue.find(issueEventsFilter, 'id').limit(limit)
    const updatedIssuesIds = updatedIssuesFound.map(i => mongoose.Types.ObjectId(i._id))

    const hasMoreIssueEvents = await getHasMoreIssueEvents({ models, issueEventsFilter, limit })

    loggerInfo('syncUpdatedIssueEvents', {
      hasMoreIssueEvents,
      limit,
      updatedIssuesIds,
      updatedIssuesFound,
      updatedIssuesIdsL: updatedIssuesIds.length
    })

    if (updatedIssuesIds.length > 0) {
      const recentlyUpdatedIssueEventsFound = await models.Issue.aggregate([
        {
          $match: { _id: { $in: updatedIssuesIds } }
        },
        ...aggregateOpsPrefixTitle,
        ...aggregateOpsEventDuration,
        {
          $set: {
            issueCustomFields: {
              $filter: {
                input: "$issueCustomFields",
                as: "issueCustomField",
                cond: {
                  $and: [
                    { $in: ["$$issueCustomField.fieldId", dateCustomFieldsIds], },
                    // { $not: { $eq: ["$$issueCustomField.outlookId", null], }, },
                    // { $not: { $in: ["$$issueCustomField.outlookId", singleEventsUpdatedOutlookIds], }, },
                    // { $not: { $in: ["$$issueCustomField.outlookId", singleEventsUpdatedOutlookIds], }, },
                    { $gte: ["$$issueCustomField.value", CalendarSyncRange.getStart()] },
                    { $lte: ["$$issueCustomField.value", CalendarSyncRange.getEnd(),], },
                  ]
                }
              },
            },
          },
        },
        { $unwind: '$issueCustomFields' },
        {
          $match: {
            $and: [
              { "issueCustomFields.outlookId": { $nin: [null, undefined] } },
              { "issueCustomFields.outlookId": { $nin: singleEventsUpdatedOutlookIds } },
            ]
          }
        },
      ]);

      loggerInfo({
        recentlyUpdatedIssueEventsFound: recentlyUpdatedIssueEventsFound.map(e => e.id),
        lastSyncInitStartAt
      })

      // eventsToUpdateInOutlook props:
      //  {
      //   reqId: ObjectId,
      //   outlookId: String,
      //   * note: spread formattedEvents for other props *
      //   ...formattedEvent: Object,
      // }
      const syncedEventsBulkUpdates = []
      const eventsToUpdateInOutlook = []

      for (const issueEvent of recentlyUpdatedIssueEventsFound) {
        const formattedEvent = formatIssueEventToOutlook(
          issueEvent,
          timeZone,
          { customFields: dateCustomFieldsFound, projectCategories }
        )
        loggerInfo({ formattedEvent })
        if (formattedEvent) {
          const outlookId = issueEvent.issueCustomFields.outlookId
          const reqId = outlookId

          eventsToUpdateInOutlook.push({
            reqId,
            outlookId,
            ...formattedEvent,
          })

          // const updatedIssueEventInOl = await updateOutlookEvent(
          //   client,
          //   issueEvent.issueCustomFields.outlookId,
          //   formattedEvent,
          //   projectCategories
          // )

          // if (updatedIssueEventInOl) {
          //   syncedOutlookIds.push(issueEvent.issueCustomFields.outlookId)
          // }

          // loggerInfo({ updatedIssueEventInOl })
        }
      }

      const updatedEventsOutlookIds = new Set()

      if (eventsToUpdateInOutlook.length > 0) {
        const client = await getClientForCalendarSync({ models, projectId, tokens })
        // const updatedOutlookEvents = await updateOutlookEventsPerBatch(
        //   client,
        //   eventsToUpdateInOutlook,
        //   projectCategories
        // )
        for (const event of eventsToUpdateInOutlook) {

          const eventOutlookId = event.outlookId
          const updatedEvent = await updateOutlookEvent(
            client,
            eventOutlookId,
            event,
            projectCategories
          )
          loggerInfo({ eventOutlookId, updatedEvent })


          // for (const updatedEvent of updatedOutlookEvents) {
          updatedEventsOutlookIds.add(updatedEvent.resId)
          // }
        }

      }

      if (updatedEventsOutlookIds.size > 0)
        await syncEventsInCalUpdLogs({
          _projectId: projectId,
          _outlookSyncId: outlookSyncId,
          _outlookIds: [...updatedEventsOutlookIds],
          _action: CalendarLogActionTypes.UPDATE
        })


      loggerInfo({ updatedEventsOutlookIds })
    }
    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: hasMoreIssueEvents
          ? OutlookCalendarSyncStatus.READY_TO_SYNC_UPDATED_ISSUE_EVENTS
          : OutlookCalendarSyncStatus.DONE_TO_SYNC_UPDATED_ISSUE_EVENTS,
        updatedAt: new Date(),
        $addToSet: {
          syncedUpdatedIssueEventsIds: { $each: updatedIssuesIds },
        }
      }
    );


    return outlookSyncId

  } catch (err) {
    loggerError('syncUpdatedIssueEvents ERROR', { errMessage: err.message, err })

    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        status: OutlookCalendarSyncStatus.FAILED_TO_SYNC_UPDATED_ISSUE_EVENTS,
        errMessage: err.message,
        updatedAt: new Date(),
        failedAt: new Date(),
      }
    );

    return err

  }
}

module.exports = {
  syncUpdatedIssueEvents,
}
