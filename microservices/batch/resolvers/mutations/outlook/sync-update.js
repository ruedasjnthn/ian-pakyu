const { getClientWithUpdateToken } = require('../../../helper/AuthHelper');
const { createCalendarEvent, updateOutlookEvent, deleteOutlookEvent, getEvent } = require('../../../helper/OutlookEventHelper');
const mongoose = require('mongoose');
const moment = require('moment');
const { OutlookSyncStatusTypes, OutlookEventTypes, RecurrenceRangeType, CalendarSyncRange } = require('../../../constants/outlook');
const { getAggregateOpsEventPrefixTitle, formatEventToOutlook, formatIssueEventToOutlook, getEventsOutlookIds, getOutlookEvent, formatUpdateEventToOutlook, getAggregateOpsEventDuration } = require('../../../helper/EventHelper');
const { isEventModified, getLatestUpdatedEvent, isEventOutOfRange, getCategoryNameArray } = require('../../../helper/SyncHelper');
const { CalendarLogActionTypes } = require('../../../constants/calendar');
const { syncEventsInCalUpdLogs } = require('../calendarUpdateLogs');
const { saveOutlookIdsOfOccurrenceEvents } = require('./sync-occurence');
const { getProjectCategories } = require('../../../helper/CategoryHelper');
const { loggerInfo, loggerError } = require('../../../config/logger');


// check what to update from updated-single-events of outlook
const updateEventsInDbAndOutlook = async ({
  singleEventsUpdated,
  syncedEventsFound,
  syncedOccurenceEventsFound,
  client,
  models,
  projectId,
  customFields,
  dateCustomFieldsIds,
  aggregateOpsPrefixTitle,
  aggregateOpsEventDuration,
  outlookSyncId,
  projectFound,
  updatedDbEventIds,
  lastSyncInitStartAt,
  masterSeriesEventsToUpdateInOutlook,
  projectCategories,
  updatedOlEventOutlookIds
}) => {
  loggerInfo('----updateEventsInDbAndOutlook singleEventsUpdatedLength', singleEventsUpdated.length, { dateCustomFieldsIds })

  const { timeZone } = projectFound || {}

  // const masterSeriesEventsToUpdateInOutlook = []
  const masterSeriesEventsToUpdateInAktenplatz = []

  const syncedEventsBulkUpdates = []
  const eventsToInsert = []
  const updatedEventsIds = []

  const deletedEventLogs = await models.CalendarUpdateLog.find({
    projectId,
    action: CalendarLogActionTypes.DELETE,
    synced: false
  })

  const isEventInUpdateLogs = (eventId) => (updatedDbEventIds || []).map(i => String(i)).includes(String(eventId))

  for (const outlookEvent of singleEventsUpdated) {

    // look for the manual event in db if not found it might be an issue event
    let dbEvent = getOutlookEvent(syncedEventsFound, outlookEvent.outlookId);

    const dbSyncedExceptionEvent =
      outlookEvent.type === OutlookEventTypes.EXCEPTION &&
      getOutlookEvent(syncedOccurenceEventsFound, outlookEvent.outlookId);

    if (dbSyncedExceptionEvent && !dbSyncedExceptionEvent.fromOutlook)
      dbEvent = dbSyncedExceptionEvent

    loggerInfo({ syncedEvent: dbEvent, outlookEvent, dbSyncedExceptionEvent })

    if (dbEvent) {
      // check if there are differences
      const isModified = isEventModified(dbEvent, outlookEvent)

      loggerInfo('isModified', isModified)
      if (isModified) {
        // test if what event has the most recent update 
        const latestUpdatedEvent = getLatestUpdatedEvent(dbEvent, outlookEvent)
        loggerInfo('latestUpdatedEvent', latestUpdatedEvent)
        // const categoryName = getCategoryNameArray(projectEventCategories, dbEvent)
        if (latestUpdatedEvent === 'event') {
          const isEventUpdatedInDb = isEventInUpdateLogs(dbEvent._id)
          loggerInfo('isEventUpdatedInDb', isEventUpdatedInDb)

          if (isEventUpdatedInDb) {
            // update event in (outlook)
            const formattedEvent = formatUpdateEventToOutlook(dbEvent, timeZone, projectCategories)
            loggerInfo('event to update in outlook: ', formattedEvent)

            if (formattedEvent) {
              const updatedEvent = await updateOutlookEvent(
                client,
                dbEvent.outlookId,
                formattedEvent,
                projectCategories
              )
              if (updatedEvent) {
                updatedEventsIds.push(dbEvent._id)
                if (dbEvent.type === OutlookEventTypes.SERIES_MASTER)
                  masterSeriesEventsToUpdateInOutlook.push(updatedEvent)

              }
              loggerInfo('updatedEvent', updatedEvent)
            }
          }
        }
        else if (latestUpdatedEvent === 'outlookEvent') {
          // update event in (db)
          loggerInfo('outlookEvent to update in db:', dbEvent)
          syncedEventsBulkUpdates.push({
            updateOne: {
              filter: { _id: mongoose.Types.ObjectId(dbEvent._id) },
              update: {
                title: outlookEvent.title,
                ...dbEvent.fromOutlook && { seriesMasterId: outlookEvent.seriesMasterId, },
                isRecurrenceEditable: outlookEvent.isRecurrenceEditable,
                type: outlookEvent.type,
                recurrence: outlookEvent.recurrence,
                location: outlookEvent.location,
                notes: outlookEvent.notes,
                categoryId: outlookEvent.categoryId,
                start: outlookEvent.start + 'Z',
                end: outlookEvent.end + 'Z',
                updatedAt: new Date(),
                isAllDay: Boolean(outlookEvent.isAllDay),
                showAs: outlookEvent.showAs,
                sensitivity: outlookEvent.sensitivity,
              }
            }
          })

          if (dbEvent.type === OutlookEventTypes.SERIES_MASTER)
            masterSeriesEventsToUpdateInAktenplatz.push(outlookEvent)
        }
      }
    } else {

      const issueOutlookIds = await models.Issue.aggregate([
        {
          $match: {
            projectId: mongoose.Types.ObjectId(projectId),
            'issueCustomFields.fieldId': { $in: dateCustomFieldsIds },
            'issueCustomFields.outlookId': outlookEvent.outlookId,
          },
        },
        {
          $set: {
            issueCustomFields: {
              $filter: {
                input: "$issueCustomFields",
                as: "issueCustomField",
                cond: {
                  $and: [
                    { $in: ["$$issueCustomField.fieldId", dateCustomFieldsIds], },
                  ]
                }
              },
            },
          },
        },
        { $unwind: '$issueCustomFields' },
        { $match: { "issueCustomFields.outlookId": outlookEvent.outlookId } },
        { $set: { outlookId: "$issueCustomFields.outlookId" } },
        { $project: { outlookId: 1 } },
      ]);


      const issueEventsFound = await models.Issue.aggregate([
        {
          $match: {
            projectId: mongoose.Types.ObjectId(projectId),
            // archived: { $not: { $eq: true } },
            // deletedAt: null,
            'issueCustomFields.fieldId': { $in: dateCustomFieldsIds },
            'issueCustomFields.outlookId': outlookEvent.outlookId,

            // note: is this necessary? probbably not, but for now it's not
            // $or: [
            //   { updatedAt: { $gte: lastSyncInitStartAt }, },
            //   { updatedPrefixAt: { $gte: lastSyncInitStartAt }, }
            // ]
          },
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
                  ]
                }
              },
            },
          },
        },
        { $unwind: '$issueCustomFields' },
        { $match: { "issueCustomFields.outlookId": outlookEvent.outlookId } },
      ]);
      const issueEvent = issueEventsFound[0];
      const issueOutlookId = issueOutlookIds[0];
      loggerInfo({
        issueEvent, issueEventsFound, issueOutlookId,
        lastSyncInitStartAt,
        lastSyncInitStartAt
      })

      if (issueEvent) {

        // const isEventUpdatedInDb = isEventInUpdateLogs(dbEvent._id);
        // loggerInfo('isEventUpdatedInDb', isEventUpdatedInDb)

        // check if issue event and outlook issue event have differences
        // const isIssueEventModifed = getIsIssueEventModified({
        //   dbIssueEvent: issueEvent,
        //   outlookEvent,
        //   timeZone
        // })

        // if issue event from outlook is has changes then update it in outlook
        // if (isIssueEventModifed) {
        const formattedEvent = formatIssueEventToOutlook(
          issueEvent,
          timeZone,
          { customFields, projectCategories }
        )
        loggerInfo({ formattedEvent })
        if (formattedEvent) {

          const updatedIssueEventInOl = await updateOutlookEvent(
            client,
            issueEvent.issueCustomFields.outlookId,
            formattedEvent,
            projectCategories
          )
          loggerInfo({ updatedIssueEventInOl })
        }
        // }

      } else if (!issueOutlookId) {
        const deletedEvent = deletedEventLogs.find(e => e.outlookId === outlookEvent.outlookId)

        const recentlyUpdated = deletedEvent && moment(deletedEvent.date).isAfter(outlookEvent.lastModifiedDateTime)
          ? 'event'
          : 'outlookEvent'

        loggerInfo('event to add', { outlookEvent, syncedEvent: dbEvent, deletedEvent, recentlyUpdated })
        if (recentlyUpdated === 'outlookEvent') {

          const syncedMasterEvent = getOutlookEvent(syncedEventsFound, outlookEvent.seriesMasterId);
          let seriesMasterId = outlookEvent.seriesMasterId;
          let fromOutlook = true

          if (syncedMasterEvent && !syncedMasterEvent.fromOutlook) {
            seriesMasterId = syncedMasterEvent._id
            fromOutlook = false
          }

          const newEvent = {
            start: outlookEvent.start + 'Z',
            end: outlookEvent.end + 'Z',
            title: outlookEvent.title || ' ',
            location: outlookEvent.location,
            notes: outlookEvent.notes,
            categoryId: outlookEvent.categoryId,
            projectId,
            seriesMasterId,
            isRecurrenceEditable: outlookEvent.isRecurrenceEditable,
            type: outlookEvent.type,
            recurrence: outlookEvent.recurrence,
            createdAt: new Date(),
            isAllDay: Boolean(outlookEvent.isAllDay),
            outlookId: outlookEvent.outlookId,
            fromOutlook,
            sensitivity: outlookEvent.sensitivity,
            showAs: outlookEvent.showAs,
          }

          // look for any outlookId duplicates and if nothing found then push to eventsToInsert array
          const outlookIdExist = eventsToInsert.find(e => e.outlookId === outlookEvent.outlookId)
          if (!outlookIdExist) eventsToInsert.push(newEvent)
        }
      }
    }
  }
  loggerInfo({ syncedEventsBulkOps: JSON.stringify(syncedEventsBulkUpdates), eventsToInsert })
  await models.Event.bulkWrite(syncedEventsBulkUpdates)
  await models.Event.insertMany(eventsToInsert)
  await syncEventsInCalUpdLogs({
    _projectId: projectId,
    _outlookSyncId: outlookSyncId,
    _eventIds: updatedEventsIds,
    _action: CalendarLogActionTypes.UPDATE
  })
  return {
    // masterSeriesEventsToUpdateInOutlook,
    masterSeriesEventsToUpdateInAktenplatz
  }
}

// update mnewly updated issue event in outlook
const updateIssueEventsInOutlook = async ({
  singleEventsUpdated,
  client,
  models,
  projectId,
  dateCustomFieldsIds,
  aggregateOpsPrefixTitle,
  aggregateOpsEventDuration,
  outlookSyncId,
  projectFound,
  lastSyncInitStartAt,
  customFields,
  projectCategories,
}) => {

  const { timeZone } = projectFound || {}


  const syncedEventsBulkUpdates = []
  const syncedOutlookIds = []

  const recentlyUpdatedIssueEvents = await models.Issue.aggregate([
    {
      $match: {
        projectId: mongoose.Types.ObjectId(projectId),
        'issueCustomFields.fieldId': { $in: dateCustomFieldsIds },
        $or: [
          { updatedAt: { $gte: lastSyncInitStartAt }, },
          { updatedPrefixAt: { $gte: lastSyncInitStartAt }, }
        ]
      },
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
          { "issueCustomFields.outlookId": { $not: { $eq: null } } },
          { "issueCustomFields.outlookId": { $nin: singleEventsUpdated.map(e => e.outlookId) } },
        ]
      }
    },
  ]);

  loggerInfo({ recentlyUpdatedIssueEvents, lastSyncInitStartAt })

  for (const issueEvent of recentlyUpdatedIssueEvents) {
    const formattedEvent = formatIssueEventToOutlook(issueEvent, timeZone, { customFields, projectCategories })
    loggerInfo({ formattedEvent })
    if (formattedEvent) {

      const updatedIssueEventInOl = await updateOutlookEvent(
        client,
        issueEvent.issueCustomFields.outlookId,
        formattedEvent,
        projectCategories
      )

      if (updatedIssueEventInOl) {
        syncedOutlookIds.push(issueEvent.issueCustomFields.outlookId)
      }

      loggerInfo({ updatedIssueEventInOl })
    }

  }

  loggerInfo({ syncedEventsBulkOps: JSON.stringify(syncedEventsBulkUpdates) })
  await syncEventsInCalUpdLogs({
    _projectId: projectId,
    _outlookSyncId: outlookSyncId,
    _outlookIds: syncedOutlookIds,
    _action: CalendarLogActionTypes.UPDATE
  })

}

const updateEventInOutlook = async ({
  models,
  projectId,
  projectFound,
  client,
  updatedOlEventOutlookIds,
  updatedDbEventIds,
  masterSeriesEventsToUpdateInOutlook,
  projectCategories,
}) => {
  const { timeZone } = projectFound || {}

  const updatedEventIds = []
  const syncedEventsToUpdateFound = await models.Event.find({
    _id: { $in: updatedDbEventIds || [] },
    projectId,
    outlookId: { $not: { $eq: null }, },
    outlookId: { $nin: updatedOlEventOutlookIds },
    type: {
      $in: [
        OutlookEventTypes.EXCEPTION,
        OutlookEventTypes.SERIES_MASTER,
        OutlookEventTypes.SINGLE_INSTANCE
      ]
    }
  });

  // UPDATE in outlook  
  for (const syncedEvent of syncedEventsToUpdateFound) {
    const formattedSyncedEvent = formatUpdateEventToOutlook(
      syncedEvent,
      timeZone,
      projectCategories
    )
    loggerInfo('event to Update formattedSyncedEvent: ', JSON.stringify(formattedSyncedEvent))

    if (formattedSyncedEvent) {
      const updatedEvent = await updateOutlookEvent(
        client,
        syncedEvent.outlookId,
        formattedSyncedEvent,
        projectCategories
      )
      loggerInfo({ updatedEvent })
      if (updatedEvent) {
        updatedEventIds.push(syncedEvent._id)
        if (syncedEvent.type === OutlookEventTypes.SERIES_MASTER) masterSeriesEventsToUpdateInOutlook.push(syncedEvent)
      }
    }
  }

  await syncEventsInCalUpdLogs({
    _projectId: projectId,
    _eventIds: updatedEventIds,
    _action: CalendarLogActionTypes.UPDATE
  })

  loggerInfo({ syncedEventsToUpdateFound, updatedEventIds })

}

// delete events in outlook 
const deleteEventsInOutlook = async ({
  models,
  projectId,
  client,
  singleEventsUpdated,
}) => {

  // get deleted events based on calendarUpdateLogs
  const deletedEventLogs = await models.CalendarUpdateLog.find({
    projectId,
    action: CalendarLogActionTypes.DELETE,
    synced: false,
    eventId: { $ne: null },
    outlookId: { $ne: null }
  })

  // get outlookIds of updated outlook events
  const updatedOlEventOutlookIds = getEventsOutlookIds(singleEventsUpdated)

  loggerInfo({ deletedEventLogs, updatedOlEventOutlookIds })

  const eventIdsToDelete = []
  const eventIdsNotDeleted = []

  for (const eventLog of deletedEventLogs) {

    let shouldDelete = true


    // check if event deleted in db has been updated in outlook
    if (updatedOlEventOutlookIds.includes(eventLog.outlookId)) {

      const updatedEvent = singleEventsUpdated.find(e => e.outlookId === eventLog.outlookId)

      // check if event deleted in db is after the update in outlook
      if (updatedEvent && updatedEvent.lastModifiedDateTime) {
        shouldDelete = moment(eventLog.date).isAfter(updatedEvent.lastModifiedDateTime)
      }

    }

    // delete event in outlook
    if (shouldDelete) {
      eventIdsToDelete.push(eventLog.eventId)
      await deleteOutlookEvent(client, eventLog.outlookId)
      loggerInfo('deleted-outlook (deleteEventsInOutlook)', eventLog.outlookId)
    } else {
      eventIdsNotDeleted.push(eventLog.eventId)
    }
  }


  await models.Event.updateMany(
    { projectId, _id: { $in: eventIdsToDelete } },
    { outlookId: null, seriesMasterId: null }
  )

  await syncEventsInCalUpdLogs({
    _projectId: projectId,
    _action: CalendarLogActionTypes.DELETE,
    _eventIds: [...eventIdsToDelete, ...eventIdsNotDeleted]
  })
}

// delete issue events in outlook 
const deleteIssueEventsInOutlook = async ({
  models,
  projectId,
  client,
}) => {

  // get deleted events based on calendarUpdateLogs
  const deletedIssueEventLogs = await models.CalendarUpdateLog.find({
    projectId,
    action: CalendarLogActionTypes.DELETE,
    synced: false,
    issueEvent: { $ne: null }
  })

  loggerInfo({ deletedIssueEventLogs })

  const updateLogIds = []
  const outlookIdsToDelete = []
  const issueEventsToDeleteBulkOps = []

  for (const issueEventLog of deletedIssueEventLogs) {
    // delete issue event in outlook
    updateLogIds.push(issueEventLog._id)
    outlookIdsToDelete.push(issueEventLog.outlookId)
    issueEventsToDeleteBulkOps.push({
      updateOne: {
        filter: {
          _id: mongoose.Types.ObjectId(issueEventLog.issueEvent.issueId),
          'issueCustomFields.fieldId': mongoose.Types.ObjectId(issueEventLog.issueEvent.customFieldId)
        },
        update: { 'issueCustomFields.$.outlookId': null }
      }
    })
  }

  loggerInfo({ updateLogIds, outlookIdsToDelete, issueEventsToDeleteBulkOps })

  for (const outlookId of outlookIdsToDelete) {
    await deleteOutlookEvent(client, outlookId)
    loggerInfo('deleted-outlook (deleteIssueEventsInOutlook)', outlookId)

  }

  await models.Issue.bulkWrite(issueEventsToDeleteBulkOps)

  await syncEventsInCalUpdLogs({
    _projectId: projectId,
    _action: CalendarLogActionTypes.DELETE,
    _ids: updateLogIds
  })

}

const deleteOutlookEventsInDb = async ({
  models,
  projectId,
  dateCustomFieldsIds,
  deletedOutlookIds = [],
}) => {

  if (deletedOutlookIds.length > 0) {
    const seriesMasterToDelete = await models.Event.find(
      { projectId, outlookId: { $in: deletedOutlookIds } }, 'id'
    )
    const toDelete = await models.Event.updateMany(
      {
        projectId,
        $or: [
          { outlookId: { $in: deletedOutlookIds } },
          { seriesMasterId: { $in: deletedOutlookIds } },
          { seriesMasterId: { $in: seriesMasterToDelete.map(e => e._id) } }
        ]
      },
      {
        deletedAt: new Date(),
      }
    )
    await models.Event.deleteMany({
      projectId,
      seriesMasterId: { $in: seriesMasterToDelete.map(e => e._id) },
      type: OutlookEventTypes.OCCURRENCE,
    })
    await models.Event.deleteMany({
      projectId,
      seriesMasterId: { $in: seriesMasterToDelete.map(e => e._id) },
      type: OutlookEventTypes.EXCEPTION,
    })
    loggerInfo('delete-debug', { toDelete, })
    await models.Issue.updateMany(
      {
        projectId: mongoose.Types.ObjectId(projectId),
        issueCustomFields: {
          $elemMatch: {
            fieldId: { $in: dateCustomFieldsIds },
            outlookId: { $in: deletedOutlookIds },
          }
        }
      },
      { $set: { "issueCustomFields.$.outlookId": null } }
    );

  }
  loggerInfo('delete-debug', { outlookEventIdsDeleted: deletedOutlookIds, dateCustomFieldsIds, })
}

const createEvents = async ({
  projectId,
  models,
  projectFound,
  client,
  outlookSyncId,
  projectCategories
}) => {

  const { timeZone, outlook } = projectFound || {}
  const { calendarId: outlookCalendarId } = outlook || {}

  // create events in outlook
  loggerInfo('>>> creating events from db to outlook...')

  const startDateTime = CalendarSyncRange.getStart()
  const endDateTime =  CalendarSyncRange.getEnd()
  // const startDateTime = moment().subtract(1, 'year').startOf('year').toDate();
  // const endDateTime = moment().add(2, 'year').endOf('year').toDate();

  const seriesMasterEventsInRange = await models.Event.aggregate([
    {
      $match: {
        projectId: mongoose.Types.ObjectId(projectId),
        type: { $in: [OutlookEventTypes.OCCURRENCE, OutlookEventTypes.EXCEPTION] },
        deletedAt: null,
        archived: { $ne: true },
        $or: [
          {
            $and: [
              { start: { $gte: startDateTime } },
              { start: { $lte: endDateTime } },
            ],
          },
          {
            $and: [
              { end: { $gte: startDateTime } },
              { end: { $lte: endDateTime } },
            ],
          },
          {
            $and: [
              { start: { $lte: startDateTime } },
              { end: { $gte: endDateTime } },
            ],
          },
        ]
      }
    },
    {
      $group: {
        _id: "$seriesMasterId"
      },
    },
    {
      $set: {
        seriesMasterObjectId: {
          $convert: {
            input: "$_id",
            to: "objectId",
            onError: null,
            // Optional.
            onNull: null// Optional.

          }
        },

      }
    },
    {
      $set: {
        seriesMasterOutlookId: {
          "$cond": {
            "if": {
              $eq: [
                "$seriesMasterObjectId",
                null
              ]
            },
            "then": "$_id",
            "else": null
          },

        },

      }
    },
  ])

  const seriesMasterEventOutlookIdsInRange = seriesMasterEventsInRange
    .filter(e => e.seriesMasterOutlookId)
    .map(e => e.seriesMasterOutlookId)

  const seriesMasterEventObjectIdsInRange = seriesMasterEventsInRange
    .filter(e => e.seriesMasterObjectId)
    .map(e => mongoose.Types.ObjectId(e.seriesMasterObjectId))

  const eventFilter = {
    projectId,
    outlookId: null,
    deletedAt: null,
    archived: { $ne: true },

    $or: [
      // for single events
      {
        type: OutlookEventTypes.SINGLE_INSTANCE,
        $or: [
          {
            $and: [
              { start: { $gte: startDateTime } },
              { start: { $lte: endDateTime } },
            ],
          },
          {
            $and: [
              { end: { $gte: startDateTime } },
              { end: { $lte: endDateTime } },
            ],
          },
          {
            $and: [
              { start: { $lte: startDateTime } },
              { end: { $gte: endDateTime } },
            ],
          },
        ]
      },
      // for series master events events
      {
        type: OutlookEventTypes.SERIES_MASTER,
        $or: [
          { _id: { $in: seriesMasterEventObjectIdsInRange } },
          { outlookId: { $in: seriesMasterEventOutlookIdsInRange } },
          { "recurrence.range.type": RecurrenceRangeType.NO_END }
        ]
      },
    ],

  }

  const eventsCount = await models.Event.count(eventFilter)
  const eventLimit = 1000;
  let createEventCount = 0;
  let createEventPage = 0;

  while (createEventCount < eventsCount) {
    const createEventsBulkOps = []
    const createdOutlookIds = []
    const createdSeriesMasterOutlookIds = []

    const eventsFound = await models.Event.find(eventFilter)
      .skip(createEventPage * eventLimit)
      .limit(eventLimit)

    for (const event of eventsFound) {
      createEventCount += 1
      loggerInfo({ event })
      // const category = projectEventCategories.find(pec => String(pec._id) === String(event.categoryId))
      // const categoryName = category && category.title
      const formattedEvent = formatEventToOutlook(event, timeZone, projectCategories);
      if (formattedEvent) {
        const createdEvent = await createCalendarEvent(
          client,
          formattedEvent,
          outlookCalendarId,
          projectCategories
        );
        loggerInfo('create-event-debug', { createdEvent })
        if (createdEvent) {
          createdOutlookIds.push(createdEvent.outlookId)
          createEventsBulkOps.push({
            updateOne: {
              filter: { _id: mongoose.Types.ObjectId(event.id) },
              update: { outlookId: createdEvent.outlookId, updatedAt: new Date() }
            }
          })
          if (createdEvent.type === OutlookEventTypes.SERIES_MASTER)
            createdSeriesMasterOutlookIds.push(createdEvent.outlookId)
        }
      }
    }
    await models.Event.bulkWrite(createEventsBulkOps)
    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        $addToSet: {
          recentlyCreatedEventsOutlookIds: { $each: createdOutlookIds },
          recentlyCreatedSeriesMasterEventsOutlookIds: { $each: createdSeriesMasterOutlookIds },
        }
      }
    );
    createEventPage += 1;
  }
}

const createIssueEvents = async ({
  models,
  projectId,
  client,
  projectFound,
  dateCustomFieldsIds,
  hiddenDateCustomFieldsIds,
  aggregateOpsPrefixTitle,
  aggregateOpsEventDuration,
  outlookSyncId,
  customFields,
  projectCategories,
}) => {

  const { timeZone, outlook } = projectFound || {}
  const { calendarId: outlookCalendarId } = outlook || {}

  loggerInfo('>>> creating issue events to outlook...')
  // find issue events to create in outlook

  const shownDateCustomFieldIds = dateCustomFieldsIds.filter(dcfId =>
    !hiddenDateCustomFieldsIds.find(hdcfId => String(dcfId) === String(hdcfId)))

  loggerInfo({ shownDateCustomFieldIds })

  const issueEventsFound = await models.Issue.aggregate([
    {
      $match: {
        projectId: mongoose.Types.ObjectId(projectId),
        archived: { $not: { $eq: true } },
        deletedAt: null,
        'issueCustomFields.fieldId': { $in: shownDateCustomFieldIds },
      },
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
                { $in: ["$$issueCustomField.fieldId", shownDateCustomFieldIds], },
              ]
            }
          },
        },
      },
    },
    { $unwind: '$issueCustomFields' },
    { $match: { "issueCustomFields.outlookId": null, "issueCustomFields.value": { $not: { $eq: null } } } },
  ]);

  loggerInfo({
    issueEventsFound: issueEventsFound.length,
    issueEventsFound: JSON.stringify(issueEventsFound)
  })

  const issueEventsParts = {}

  const issueEventsLimit = 1000
  const issueEventsPages = Math.ceil(issueEventsFound.length / issueEventsLimit)

  for (let i = 0; i < issueEventsPages; i += 1) {
    const start = i * issueEventsLimit;
    const end = start + issueEventsLimit
    issueEventsParts[i] = issueEventsFound.slice(start, end)
  }

  for (const key in issueEventsParts) {
    if (key && issueEventsParts[key]) {
      const createIssueEventsBulkOps = [];
      const createdOutlookIds = []

      for (const issueEvent of issueEventsParts[key]) {
        const formattedEvent = formatIssueEventToOutlook(
          issueEvent,
          timeZone,
          {
            customFields,
            projectCategories,
          }
        );

        if (formattedEvent) {
          const isOutsideRange = isEventOutOfRange({
            eventStartDate: formattedEvent.start.dateTime,
            timeZone
          });

          if (!isOutsideRange) {
            const createdEvent = await createCalendarEvent(
              client,
              formattedEvent,
              outlookCalendarId,
              projectCategories
            );

            if (createdEvent) {
              createdOutlookIds.push(createdEvent.outlookId)
              createIssueEventsBulkOps.push({
                updateOne: {
                  filter: {
                    _id: mongoose.Types.ObjectId(issueEvent._id),
                    'issueCustomFields.fieldId': mongoose.Types.ObjectId(issueEvent.issueCustomFields.fieldId)
                  },
                  update: {
                    '$set': {
                      'issueCustomFields.$.outlookId': createdEvent.outlookId,
                    },
                  }
                }
              })
            }
          }

        }
      }
      await models.Issue.bulkWrite(createIssueEventsBulkOps)
      await models.OutlookSync.updateOne(
        { _id: outlookSyncId },
        {
          $addToSet: { recentlyCreatedIssueEventsOutlookIds: { $each: createdOutlookIds } }
        }
      );
    }
  }
}

const updateOccurenceEvents = async ({
  seriesMasterEvents,
  seriesOccurrenceEvents: outlookUpdatedOccurenceEvents,
  masterSeriesEventsToUpdateInOutlook,
  masterSeriesEventsToUpdateInAktenplatz,
  models,
  projectId,
  lastSyncInitStartAt,
  singleEventsUpdated
}) => {
  loggerInfo('---updateOccurenceEvents----')
  loggerInfo({
    masterSeriesEventsToUpdateInOutlook,
    masterSeriesEventsToUpdateInAktenplatz
  })
  const masterEventsOids = seriesMasterEvents.map(e => e.outlookId)

  const syncedOccurrenceEvents = await models.Event.find({
    projectId,
    seriesMasterId: { $in: masterEventsOids },
    fromOutlook: true,
    type: OutlookEventTypes.OCCURRENCE,
  })

  const appSeriesMasterEvents = await models.Event.find({
    projectId,
    fromOutlook: { $ne: true },
    type: OutlookEventTypes.SERIES_MASTER,
    deletedAt: null
  })

  const syncedOutlookSeriesMasterEvents = await models.Event.find({
    projectId,
    fromOutlook: true,
    type: OutlookEventTypes.SERIES_MASTER,
    deletedAt: null
  })

  const appSeriesMasterEventsIds = appSeriesMasterEvents.map(e => String(e._id))
  const appSeriesMasterEventsOutlookIds = appSeriesMasterEvents.map(e => (e.outlookId))

  const syncedAppOccurenceEvents = await models.Event.find({
    projectId,
    fromOutlook: { $ne: true },
    outlookId: { $ne: null },
    seriesMasterId: { $in: appSeriesMasterEventsIds },
    type: OutlookEventTypes.OCCURRENCE,
    deletedAt: null
  })
  const syncedAppOccurenceEventsIds = syncedAppOccurenceEvents.map(e => mongoose.Types.ObjectId(e._id))
  const syncedAppOccurenceEventsOutlookIds = syncedAppOccurenceEvents.map(e => e.outlookId)

  loggerInfo({
    masterEventsOids,
    seriesMasterEvents,
    syncedOccurrenceEvents,
    appSeriesMasterEvents,
    syncedOutlookSeriesMasterEvents,
    appSeriesMasterEventsIds,
    appSeriesMasterEventsOutlookIds,
    syncedAppOccurenceEvents,
    syncedAppOccurenceEventsIds,
    syncedAppOccurenceEventsOutlookIds,
  })

  const updateExceptionEventsOutlookIds = singleEventsUpdated
    .filter(e => e.type === OutlookEventTypes.EXCEPTION)
    .map(e => e.outlookId)

  const eventLogs = await models.CalendarUpdateLog.find({
    projectId,
    // action: CalendarLogActionTypes.DELETE,
    date: { $gte: lastSyncInitStartAt }
  }).sort('-date')

  // const updatedEventLogs = await models.CalendarUpdateLog.find({
  //   projectId,
  //   action: CalendarLogActionTypes.UPDATE,
  //   date: { $gte: lastSyncInitStartAt }
  // })

  const occurrenceEventsBulkUpdates = []

  for (const masterEvent of seriesMasterEvents) {

    let masterEventInDB = getOutlookEvent([
      ...appSeriesMasterEvents,
      ...syncedOutlookSeriesMasterEvents,
    ], masterEvent.outlookId);

    const isEventFromOutlook = !appSeriesMasterEventsOutlookIds.includes(masterEvent.outlookId)
    const eventLog = eventLogs.find(e => e.outlookId === masterEvent.outlookId)
    // const updatedEvent = updatedEventLogs.find(e => e.outlookId === masterEvent.outlookId)

    // const deletedEventDate = deletedEvent && deletedEvent.date
    // const updatedEventDate = updatedEvent && updatedEvent.date
    // const date = deletedEventDate || updatedEventDate;

    const recentlyUpdated = eventLog && moment(eventLog.date).isAfter(masterEvent.lastModifiedDateTime)
      ? 'event'
      : 'outlookEvent'

    // const isModified = isEventModified(masterEventInDB, masterEvent)

    loggerInfo({
      isEventFromOutlook, recentlyUpdated, masterEvent,
      eventLog,
      masterEventInDB,
      // isModified
    })


    if (recentlyUpdated === 'outlookEvent') {
      await models.Event.updateOne({ outlookId: masterEvent.outlookId, projectId }, { deletedAt: null })
      if (isEventFromOutlook) {

        // get outlook updated occurence events of the master event
        const outlookUpdOccEvents = outlookUpdatedOccurenceEvents.filter(e => e.seriesMasterId === masterEvent.outlookId)
        const outlookUpdOccEvOids = outlookUpdOccEvents.map(e => e.outlookId)

        // get synced occurence events of master events to update in db(which are recently updated in outlook)
        const syncedOccEventsToUpdate = syncedOccurrenceEvents.filter(e =>
          e.outlookId === masterEvent.outlookId &&
          outlookUpdOccEvOids.includes(e.outlookId)
        )
        const syncedOccEventsToUpdateOids = syncedOccEventsToUpdate.map(e => e.outlookId)

        // get outlook updated occurence events(that were not found in the db) to be created in the db
        const occurenceEventsToCreate = outlookUpdOccEvents.filter(e =>
          !syncedOccEventsToUpdateOids.includes(e.outlookId)
        )

        // check if the most recent update of master event is in outlook or db
        const metoUpdateInOl = masterSeriesEventsToUpdateInOutlook.find(e => e.outlookId === masterEvent.outlookId)

        // get outlook master event in
        const dbOutlookMasterEvent = syncedOutlookSeriesMasterEvents.find(e => e.outlookId === masterEvent.outlookId)

        // if the recent update is from outlook
        const ableToUpdate = Boolean(!metoUpdateInOl)
        loggerInfo('ableToUpdate', ableToUpdate)
        loggerInfo({ syncedOccEventsToUpdate, metoUpdateInOl, masterEvent, dbOutlookMasterEvent })
        // update occurence events
        if (ableToUpdate) {

          // delete all occurence events to recreate occurence events again
          const occEventsToDelete = await models.Event.find(
            {
              projectId,
              fromOutlook: true,
              type: OutlookEventTypes.OCCURRENCE,
              seriesMasterId: masterEvent.outlookId,
              outlookId: { $nin: syncedOccEventsToUpdateOids },
            },
            'id'
          )

          // add to bulk ops to delete occurences
          const expEventsToDelete = await models.Event.find(
            {
              projectId,
              fromOutlook: true,
              type: OutlookEventTypes.EXCEPTION,
              seriesMasterId: masterEvent.outlookId,
              outlookId: { $nin: updateExceptionEventsOutlookIds }
            },
            'id'
          )

          const seriesEventIdsToDeleteLater = [
            ...occEventsToDelete.map(e => e.id),
            ...expEventsToDelete.map(e => e.id)
          ]

          loggerInfo({ seriesEventIdsToDeleteLater })

          // // delete all occurence events to recreate occurence events again
          // await models.Event.deleteMany({
          //   projectId,
          //   fromOutlook: true,
          //   type: OutlookEventTypes.OCCURRENCE,
          //   seriesMasterId: masterEvent.outlookId,
          //   outlookId: { $nin: syncedOccEventsToUpdateOids },
          // })

          // // add to bulk ops to delete occurences
          // await models.Event.deleteMany({
          //   projectId,
          //   fromOutlook: true,
          //   type: OutlookEventTypes.EXCEPTION,
          //   seriesMasterId: masterEvent.outlookId,
          //   outlookId: { $nin: updateExceptionEventsOutlookIds }
          // })

          // update occurence events that are synced
          for (const event of syncedOccEventsToUpdate) {
            occurrenceEventsBulkUpdates.push({
              updateOne: {
                filter: {
                  _id: mongoose.Types.ObjectId(event._id),
                  projectId: mongoose.Types.ObjectId(projectId),
                  outlookId: event.outlookId,
                  seriesMasterId: event.seriesMasterId
                },
                update: {
                  start: event.start + 'Z',
                  end: event.end + 'Z',

                  outlookId: event.outlookId,
                  type: event.type,
                  projectId,

                  updatedAt: new Date(),
                  fromOutlook: dbOutlookMasterEvent.fromOutlook,
                  createdAt: dbOutlookMasterEvent.createdAt,
                  userIds: dbOutlookMasterEvent.userIds,

                  title: masterEvent.title || ' ',
                  location: masterEvent.location,
                  notes: masterEvent.notes,
                  isAllDay: Boolean(masterEvent.isAllDay),
                  categoryId: masterEvent.categoryId,
                  isRecurrenceEditable: masterEvent.isRecurrenceEditable,

                  sensitivity: masterEvent.sensitivity,
                  showAs: masterEvent.showAs,
                }
              }
            })
          }

          await models.Event.bulkWrite(occurrenceEventsBulkUpdates)

          const occurenceEventsToInsert = []
          // const occurenceEventsBulk = await models.Event.insertMany()
          // create occurence events of updated master event
          for (const event of occurenceEventsToCreate) {
            const existingOutlookId = occurenceEventsToInsert.find(e => e.outlookId === event.outlookId)
            if (!existingOutlookId)
              occurenceEventsToInsert.push({
                start: event.start + 'Z',
                end: event.end + 'Z',

                seriesMasterId: event.seriesMasterId,
                outlookId: event.outlookId,
                type: event.type,
                projectId,
                fromOutlook: true,
                createdAt: new Date(),

                title: masterEvent.title || ' ',
                location: masterEvent.location,
                notes: masterEvent.notes,
                userIds: dbOutlookMasterEvent.userIds,

                isAllDay: Boolean(masterEvent.isAllDay),
                categoryId: masterEvent.categoryId,
                isRecurrenceEditable: masterEvent.isRecurrenceEditable,

                sensitivity: masterEvent.sensitivity,
                showAs: masterEvent.showAs,
              })
          }

          await models.Event.insertMany(occurenceEventsToInsert)
          await models.Event.updateMany({
            _id: { $in: seriesEventIdsToDeleteLater }
          }, { deletedAt: new Date() })
          // await models.Event.deleteMany({
          //   _id: { $in: seriesEventIdsToDeleteLater }
          // })

        }

      } else {

        const appMasterEvent = appSeriesMasterEvents.find(e => e.outlookId === masterEvent.outlookId)

        loggerInfo({
          appMasterEvent,

        })
        // check if the most recent update is in outlook
        const metoUpdateInAkt = masterSeriesEventsToUpdateInAktenplatz.find(e => e.outlookId === appMasterEvent.outlookId)
        // if the recent update is from outlook
        const ableToUpdate = Boolean(metoUpdateInAkt)

        if (ableToUpdate && appMasterEvent) {

          const occurenceEventsToUpdateFromOutlook = outlookUpdatedOccurenceEvents.filter(e =>
            syncedAppOccurenceEventsOutlookIds.includes(e.outlookId) && masterEvent.outlookId === e.seriesMasterId
          )

          const occEventsToDelete = await models.Event.find({
            projectId,
            fromOutlook: { $ne: true },
            type: OutlookEventTypes.OCCURRENCE,
            seriesMasterId: appMasterEvent._id,
            outlookId: { $nin: occurenceEventsToUpdateFromOutlook.map(e => e.outlookId) }
          }, 'id')

          const occurenceEventsToCreateAgain = outlookUpdatedOccurenceEvents.filter(e =>
            !syncedAppOccurenceEventsOutlookIds.includes(e.outlookId)
            && e.seriesMasterId === appMasterEvent.outlookId
          )

          const expEventsToDelete = await models.Event.find({
            projectId,
            fromOutlook: { $ne: true },
            type: OutlookEventTypes.EXCEPTION,
            seriesMasterId: appMasterEvent._id,
            outlookId: { $nin: updateExceptionEventsOutlookIds }
          }, 'id')


          const oldSeriesEventsToDelete = [
            ...expEventsToDelete.map(e => e.id),
            ...occEventsToDelete.map(e => e.id),
          ]

          loggerInfo('debug occurence events', {
            appMasterEvent,
            masterEvent,
            occurenceEventsToUpdateFromOutlook,
            occurenceEventsToCreateAgain,
            expEventsToDelete,
            occEventsToDelete,
            updateExceptionEventsOutlookIds
          })

          // update occurence events that are synced
          for (const event of occurenceEventsToUpdateFromOutlook) {

            const occurenceEvent = syncedAppOccurenceEvents.find(e => e.outlookId === event.outlookId)

            occurrenceEventsBulkUpdates.push({
              updateOne: {
                filter: {
                  _id: mongoose.Types.ObjectId(occurenceEvent._id),
                  projectId: mongoose.Types.ObjectId(projectId),
                  seriesMasterId: occurenceEvent.seriesMasterId
                },
                update: {
                  start: event.start + 'Z',
                  end: event.end + 'Z',

                  outlookId: event.outlookId,
                  type: event.type,
                  projectId,
                  updatedAt: new Date(),
                  userIds: appMasterEvent.userIds,

                  title: masterEvent.title || ' ',
                  location: masterEvent.location,
                  notes: masterEvent.notes,
                  isAllDay: Boolean(masterEvent.isAllDay),
                  categoryId: masterEvent.categoryId,
                  isRecurrenceEditable: masterEvent.isRecurrenceEditable,

                  sensitivity: masterEvent.sensitivity,
                  showAs: masterEvent.showAs,
                }
              }
            })
          }

          await models.Event.bulkWrite(occurrenceEventsBulkUpdates)

          const occurenceEventsToInsert = []

          // create occurence events of updated master event
          for (const event of occurenceEventsToCreateAgain) {
            const existingOutlookId = occurenceEventsToInsert.find(e => e.outlookId === event.outlookId)
            if (!existingOutlookId)
              occurenceEventsToInsert.push({
                start: event.start + 'Z',
                end: event.end + 'Z',

                seriesMasterId: String(appMasterEvent._id),
                outlookId: event.outlookId,
                type: event.type,
                projectId,
                userIds: appMasterEvent.userIds,
                createdAt: appMasterEvent.createdAt,
                updatedAt: new Date(),

                title: masterEvent.title || ' ',
                location: masterEvent.location,
                notes: masterEvent.notes,

                isAllDay: Boolean(masterEvent.isAllDay),
                categoryId: masterEvent.categoryId,
                isRecurrenceEditable: masterEvent.isRecurrenceEditable,

                sensitivity: masterEvent.sensitivity,
                showAs: masterEvent.showAs,
              })
          }

          await models.Event.insertMany(occurenceEventsToInsert)

          await models.Event.updateMany({ _id: { $in: oldSeriesEventsToDelete } }, { deletedAt: new Date() })
          // await models.Event.deleteMany({ _id: { $in: oldSeriesEventsToDelete } })

        }
      }
      // loggerInfo({
      //   occurrenceEventsBulkOps: JSON.stringify(occurrenceEventsBulkOps)
      // })
      // await models.Event.bulkWrite(occurrenceEventsBulkOps)
    }
  }
}


// // update occurence events from outlook to aktenplatz
// const updateSeriesEvents = async ({
//   seriesMasterEvents,
//   seriesOccurrenceEvents: outlookUpdatedOccurenceEvents,
//   masterSeriesEventsToUpdateInOutlook,
//   models,
//   projectId,
//   lastSyncInitStartAt,
//   singleEventsUpdated
// }) => {

//   // loop ocurence events

//   // get aktenplatz of each outlook occurence event
//   // get masterEvent of outlook occurence event from seriesMasterEvents list

//   // if from outloook then get log action of the event from CalendarUpdateLog

//   // check if what event is recently updated or deleted

//   // if outlook event is recently deleted 
//   // if aktenplatz event is recently deleted 

//   // if outlook event is recently updated 
//   // if aktenplatz event is recently updated 


// }


const checkForDeletedEventsFromAktenplatzInOutlook = async ({
  projectId,
  models,
  dateCustomFieldsIds,
  outlookSyncId,
  recentlyCreatedEventsOutlookIds,
  recentlyCreatedIssueEventsOutlookIds,
  singleEventsUpdated,
  seriesOccurrenceEvents,
  accessToken,
  refreshToken,
}) => {
  const updatedEventsOutlookIds = [
    ...singleEventsUpdated.map(e => e.outlookId),
    ...seriesOccurrenceEvents.map(e => e.outlookId),
  ];

  // const recentlyCreatedEventsOutlookIdsNotIn = recentlyCreatedEventsOutlookIds.filter(oid => !updatedEventsOutlookIds.includes(oid));
  // const deletedIssueEventsOutlookIds = recentlyCreatedIssueEventsOutlookIds.filter(oid => !updatedEventsOutlookIds.includes(oid));
  const deletedEventsOutlookIds = []
  const deletedIssueEventsOutlookIds = []


  // check outlookId if it still exist in outlook if not add to events to remove
  for (const outlookId of recentlyCreatedEventsOutlookIds) {
    const event = await getEvent(accessToken, refreshToken, outlookId)
    if (event && event.id === outlookId) {
      // do not do anything it means outlook event still exist
    } else {
      // if it is not found or the event returned is false then delete in db
      deletedEventsOutlookIds.push(outlookId)
    }
  }

  for (const outlookId of recentlyCreatedIssueEventsOutlookIds) {
    const event = await getEvent(accessToken, refreshToken, outlookId)
    if (event && event.id === outlookId) {
      // do not do anything it means outlook event still exist
    } else {
      // if it is not found or the event returned is false then delete in db
      deletedIssueEventsOutlookIds.push(outlookId)
    }
  }


  loggerInfo({
    deletedEventsOutlookIds,
    deletedIssueEventsOutlookIds
  })

  const masterEventsFromDb = await models.Event.find(
    {
      projectId,
      outlookId: { $in: deletedEventsOutlookIds }
    },
    'id'
  )
  const masterEventIdsToDelete = masterEventsFromDb.map(e => e.id)

  await models.Event.updateMany(
    {
      projectId,
      outlookId: { $in: deletedEventsOutlookIds }
    },
    {
      deletedAt: new Date(),
    }
  )

  // update events deletedAt
  await models.Event.updateMany(
    {
      projectId,
      $or: [
        { seriesMasterId: { $in: deletedEventsOutlookIds } },
        { seriesMasterId: { $in: masterEventIdsToDelete } },
      ]
    },
    {
      deletedAt: new Date(),
    }
  )
  // await models.Event.deleteMany({
  //   projectId,
  //   $or: [
  //     { seriesMasterId: { $in: deletedEventsOutlookIds } },
  //     { seriesMasterId: { $in: masterEventIdsToDelete } },
  //   ]
  // })

  await models.Issue.updateMany(
    {
      projectId: mongoose.Types.ObjectId(projectId),
      issueCustomFields: {
        $elemMatch: {
          fieldId: { $in: dateCustomFieldsIds },
          outlookId: { $in: deletedIssueEventsOutlookIds },
        }
      }
    },
    { $set: { "issueCustomFields.$.outlookId": null } }
  );

  await models.OutlookSync.updateOne(
    { _id: outlookSyncId },
    {
      recentlyCreatedEventsOutlookIds: [],
      recentlyCreatedIssueEventsOutlookIds: []
    }
  );

}

const updateOutlookEventsWithRenamedCategories = async ({
  projectId,
  models,
  client,
  lastSyncInitStartAt,
  projectCategories
}) => {
  loggerInfo('--------- updateOutlookEventsWithRenamedCategories -------');
  const cocRenamed = await models.OutlookCategory.find({
    projectId,
    createdAt: { $gte: lastSyncInitStartAt },
    updatedNameCategoryId: { $ne: null },
    deletedAt: null
  })

  const eventsToUpdate = await models.Event.find({
    projectId,
    categoryId: { $in: cocRenamed.map(coc => coc._id), },
    outlookId: { $ne: null }
  })

  const cfUpdatedCoc = await models.CustomField.find({
    projectId,
    categoryId: { $in: cocRenamed.map(coc => coc._id), },
  })

  const issueEventsToUpdate = await models.Issue.find({
    projectId,
    "issueCustomFields.fieldId": { $in: cfUpdatedCoc.map(cf => cf.id) },
  })

  loggerInfo({
    cfUpdatedCoc,
    issueEventsToUpdate,
  })

  for (const event of eventsToUpdate) {
    const categories = getCategoryNameArray(cocRenamed, event)
    loggerInfo({ categories })
    if (categories) {
      const updatedOlEvent = await updateOutlookEvent(
        client,
        event.outlookId,
        { categories },
        projectCategories
      )
      loggerInfo({ updatedOlEvent })
    }
  }

  for (const issue of issueEventsToUpdate) {

    for (const icf of issue.issueCustomFields) {
      const field = cfUpdatedCoc.find(cf => String(cf.id) === String(icf.fieldId))
      if (field && icf.outlookId) {
        const category = cocRenamed.find(coc => String(coc._id) === String(field.categoryId))
        loggerInfo({ category })
        if (category) {
          const categories = [category.displayName]
          loggerInfo({ categories })
          const updatedOlEvent = await updateOutlookEvent(
            client,
            icf.outlookId,
            { categories },
            projectCategories
          )
          loggerInfo({ updatedOlEvent })
        }
      }
    }
  }

  loggerInfo({
    cocRenamed,
    eventsToUpdate,
    lastSyncInitStartAt
  })
}

const deleteOutlookIssueEventsHiddenCustomFields = async ({
  models,
  client,
  projectId,
  hiddenDateCustomFieldsIds
}) => {

  loggerInfo({ hiddenDateCustomFieldsIds })

  const issuesToDelete = await models.Issue.aggregate([
    {
      $match: {
        projectId: mongoose.Types.ObjectId(projectId),
        'issueCustomFields.fieldId': { $in: hiddenDateCustomFieldsIds },
      },
    },
    {
      $set: {
        issueCustomFields: {
          $filter: {
            input: "$issueCustomFields",
            as: "issueCustomField",
            cond: {
              $and: [
                { $in: ["$$issueCustomField.fieldId", hiddenDateCustomFieldsIds], },
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
          { "issueCustomFields.outlookId": { $not: { $eq: null } } },
        ]
      }
    },
  ]);

  loggerInfo({ issuesToDelete })

  const issueEventsUpdateBulkOps = []
  for (const issue of issuesToDelete) {
    const issueCustomField = issue.issueCustomFields
    const eventOutlookId = issueCustomField && issueCustomField.outlookId

    loggerInfo({ issueCustomField, eventOutlookId, })

    if (eventOutlookId) {
      const isOutlookEventDeleted = await deleteOutlookEvent(client, eventOutlookId)
      if (isOutlookEventDeleted)
        issueEventsUpdateBulkOps.push({
          updateOne: {
            filter: {
              _id: mongoose.Types.ObjectId(issue._id),
              'issueCustomFields.fieldId': mongoose.Types.ObjectId(issueCustomField.fieldId)
            },
            update: {
              '$unset': {
                'issueCustomFields.$.outlookId': "",
              },
            }
          }
        })
    }
  }

  loggerInfo({
    issueEventsUpdateBulkOps: JSON.stringify(issueEventsUpdateBulkOps)
  })

  await models.Issue.bulkWrite(issueEventsUpdateBulkOps)

}

// -----------------------------
// SYNC CALENDAR UPDATE MUTATION
// -----------------------------
const syncCalendarUpdate = async (_, { projectId, outlookSyncId }, { models }) => {
  const startTime = Date.now()
  try {
    loggerInfo('--------------- sync Calendar Update -----------------------')
    // update outlooksync status and stimestamp
    await models.OutlookSync.updateOne({ _id: outlookSyncId }, {
      status: OutlookSyncStatusTypes.SYNCING,
      syncStartAt: new Date()
    })

    // find project
    const projectFound = await models.Project.findById(projectId)

    // define variables
    const {
      accessToken,
      refreshToken,
      calendarId: outlookCalendarId
    } = projectFound && projectFound.outlook || {}
    const client = await getClientWithUpdateToken({ accessToken, refreshToken, projectId, models })
    const timeZone = projectFound && projectFound.timeZone
    const projectPrefixes = [...(projectFound && projectFound.prefixes) || []]
      .sort((a, b) => (a.position - b.position))
    const prefixesFieldIds = projectPrefixes.filter(p => p.fieldId).map(p => mongoose.Types.ObjectId(p.fieldId))

    const projectCategories = await getProjectCategories({ projectId })

    const aggregateOpsPrefixTitle = getAggregateOpsEventPrefixTitle({ prefixesFieldIds, projectPrefixes })


    // const dateCustomFieldsFound = await models.CustomField.find({
    //   projectId,
    //   type: 'date'
    // });
    const projectCustomFieldsFound = await models.CustomField.find({
      projectId,
      type: { $in: ['checkbox', 'date'] },
    });

    // find date custom fields
    const dateCustomFieldsFound = projectCustomFieldsFound.filter(f => f.type === 'date')
    const dateCustomFieldsIds = await dateCustomFieldsFound.map(cf => mongoose.Types.ObjectId(cf._id))

    const hiddenDateCustomFieldsFound = dateCustomFieldsFound.filter(f => f.hideFromCalendar)
    const hiddenDateCustomFieldsIds = hiddenDateCustomFieldsFound.map(cf => mongoose.Types.ObjectId(cf._id))

    // get checkbox customfields
    const checkboxCustomFieldsFound = projectCustomFieldsFound.filter(f => f.type === 'checkbox')
    const checkboxCustomFieldsIds = checkboxCustomFieldsFound.map(f => f._id)

    const aggregateOpsEventDuration = getAggregateOpsEventDuration({
      projectCheckBoxFieldsIds: checkboxCustomFieldsIds,
      projectDateCustomFields: dateCustomFieldsFound
    })

    const outlookSyncFound = await models.OutlookSync.findById(outlookSyncId)

    const outlookEventIdsDeleted = await outlookSyncFound.outlookEventIdsDeleted || []
    const singleEventsUpdated = await (outlookSyncFound.singleEventsUpdated || [])
      .filter(se => !outlookEventIdsDeleted.includes(se.outlookId))
    const seriesMasterEvents = await (outlookSyncFound.seriesMasterEvents || [])
      .filter(se => !outlookEventIdsDeleted.includes(se.outlookId))
    const seriesOccurrenceEvents = await outlookSyncFound.seriesOccurrenceEvents || []

    const recentlyCreatedEventsOutlookIds = await outlookSyncFound.recentlyCreatedEventsOutlookIds || []
    const recentlyCreatedIssueEventsOutlookIds = await outlookSyncFound.recentlyCreatedIssueEventsOutlookIds || []

    // const syncedSeriesMasterEvents = await models.Event.find({
    //   projectFound,
    //   type: OutlookEventTypes.SERIES_MASTER
    // })

    // get outlookIds of updated outlook events
    const updatedOlEventOutlookIds = getEventsOutlookIds(singleEventsUpdated)

    // get deleted outlookIds 
    const deletedOutlookIds = outlookSyncFound.outlookEventIdsDeleted;

    const syncedEventsFound = await models.Event.find({
      projectId,
      outlookId: { $in: updatedOlEventOutlookIds },
      type: { $not: { $eq: OutlookEventTypes.OCCURRENCE } },
      deletedAt: null,
    })

    const syncedOccurenceEventsFound = await models.Event.find({
      projectId,
      outlookId: { $in: updatedOlEventOutlookIds },
      type: OutlookEventTypes.OCCURRENCE,
      deletedAt: null,
    })

    // get updated events based on calendarUpdateLogs
    const updatedEventLogs = await models.CalendarUpdateLog.find({
      projectId,
      action: CalendarLogActionTypes.UPDATE,
      synced: false,
      eventId: { $ne: null }
    })

    const updatedDbEventIds = updatedEventLogs.map(l => l.eventId)

    loggerInfo('updatedDbEventIds', {
      updatedDbEventIds
    })


    loggerInfo('event lists', {
      syncedEventsFoundL: syncedEventsFound.length,
      outlookEventIdsDeleted,
      // syncedSeriesMasterEvents,
      singleEventsUpdated,
      seriesMasterEvents,
      seriesOccurrenceEvents

    })

    const masterSeriesEventsToUpdateInOutlook = []

    // check for deleted events 
    await checkForDeletedEventsFromAktenplatzInOutlook({
      projectId,
      models,
      dateCustomFieldsIds,
      outlookSyncId,
      recentlyCreatedEventsOutlookIds,
      recentlyCreatedIssueEventsOutlookIds,
      singleEventsUpdated,
      seriesOccurrenceEvents,
      accessToken,
      refreshToken,
      updatedOlEventOutlookIds,
    })

    // -------------------------
    // ----- UPDATE EVENT ------
    // -------------------------
    const {
      masterSeriesEventsToUpdateInAktenplatz
    } = await updateEventsInDbAndOutlook({
      singleEventsUpdated,
      syncedEventsFound,
      syncedOccurenceEventsFound,
      client,
      models,
      projectId,
      customFields: dateCustomFieldsFound,
      dateCustomFieldsIds,
      aggregateOpsPrefixTitle,
      aggregateOpsEventDuration,
      outlookSyncId,
      projectFound,
      updatedDbEventIds,
      lastSyncInitStartAt: outlookSyncFound.lastSyncInitStartAt,
      masterSeriesEventsToUpdateInOutlook,
      projectCategories
    })

    await updateEventInOutlook({
      models,
      projectId,
      projectFound,
      client,
      updatedOlEventOutlookIds,
      updatedDbEventIds,
      masterSeriesEventsToUpdateInOutlook,
      projectCategories
    })

    await updateIssueEventsInOutlook({
      singleEventsUpdated,
      client,
      models,
      projectId,
      dateCustomFieldsIds,
      aggregateOpsPrefixTitle,
      aggregateOpsEventDuration,
      outlookSyncId,
      projectFound,
      lastSyncEndAt: outlookSyncFound.syncEndAt,
      lastSyncInitStartAt: outlookSyncFound.lastSyncInitStartAt,
      customFields: dateCustomFieldsFound,
      projectCategories,
    })

    // ------------------------------
    // ------- DELETE EVENTS --------
    // ------------------------------
    await deleteEventsInOutlook({
      models,
      projectId,
      client,
      singleEventsUpdated,
    })

    await deleteIssueEventsInOutlook({
      models,
      projectId,
      client,
      dateCustomFieldsIds,
    })

    // DELETE in db
    await deleteOutlookEventsInDb({
      models,
      projectId,
      dateCustomFieldsIds,
      deletedOutlookIds
    })

    // DELETE in db
    await deleteOutlookIssueEventsHiddenCustomFields({
      models,
      client,
      projectId,
      hiddenDateCustomFieldsIds
    })

    // ----------------------------------
    // -------- CREATING EVENTS ---------
    // ----------------------------------
    await createEvents({
      projectId,
      models,
      projectFound,
      client,
      outlookSyncId,
      projectCategories
    })

    await createIssueEvents({
      models,
      projectId,
      client,
      projectFound,
      dateCustomFieldsIds,
      aggregateOpsPrefixTitle,
      aggregateOpsEventDuration,
      outlookSyncId,
      customFields: dateCustomFieldsFound,
      projectCategories,
      hiddenDateCustomFieldsIds,
    })

    // -------------------------------------
    // ------ UPDATE OCCURRENCE EVENTS ------
    // -------------------------------------
    await updateOccurenceEvents({
      models,
      projectId,
      seriesMasterEvents,
      seriesOccurrenceEvents,
      masterSeriesEventsToUpdateInOutlook,
      masterSeriesEventsToUpdateInAktenplatz,
      lastSyncEndAt: outlookSyncFound.syncEndAt,
      lastSyncInitStartAt: outlookSyncFound.lastSyncInitStartAt,
      singleEventsUpdated,
    })

    await saveOutlookIdsOfOccurrenceEvents({
      projectId,
      models,
      outlookSyncId,
      accessToken,
      refreshToken,
      client,
      masterSeriesEventsToUpdateInOutlook,
      timeZone,
      projectCategories
    })

    // update events that have recently renamed categories
    await updateOutlookEventsWithRenamedCategories({
      projectId,
      models,
      lastSyncInitStartAt: outlookSyncFound.lastSyncInitStartAt,
      client,
      projectCategories
    })


    // update outlook sync
    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        started: false,
        finished: true,
        status: OutlookSyncStatusTypes.SUCCESS,
        syncEndAt: new Date(),
        failedAt: null,
        newDeltaLink: null,
        ...outlookSyncFound.newDeltaLink && { deltaLink: outlookSyncFound.newDeltaLink },
      }
    )

    const endTime = Date.now()

    loggerInfo(' ----- done sync --------')
    loggerInfo('time', (endTime - startTime) / 1000 + ' seconds')
    return outlookSyncId

  } catch (err) {
    loggerError('ERROR: syncCalendarUpdate, ', err.message)
    await models.OutlookSync.updateOne(
      { _id: outlookSyncId },
      {
        started: false,
        finished: true,
        status: OutlookSyncStatusTypes.FAILED_SYNCING,
        failedAt: new Date(),
      }
    )
    return err
  }
};


module.exports = {
  syncCalendarUpdate
}
