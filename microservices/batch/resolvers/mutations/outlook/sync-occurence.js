const { OutlookEventTypes } = require("../../../constants/outlook")
const { getOccurrenceSeriesEvent, deleteOutlookEvent, updateOutlookEvent, deleteOutlookEvents20PerBatch } = require("../../../helper/OutlookEventHelper")
const moment = require('moment');
const momentTz = require('moment-timezone');
const mongoose = require('mongoose');
const { formatEventToOutlook } = require("../../../helper/EventHelper");
const { dateComparingFormat, defaultTimeZone } = require("../../../constants/calendar");
const { loggerInfo } = require('../../../config/logger');

const saveOutlookIdsOfOccurrenceEvents = async ({
  projectId,
  models,
  outlookSyncId,
  accessToken,
  refreshToken,
  client,
  masterSeriesEventsToUpdateInOutlook = [],
  timeZone,
  projectCategories,
  matchedExceptionEventIds = []
}) => {
  loggerInfo('----- saveOutlookIdsOfOccurrenceEvents')

  const outlookSyncFound = await models.OutlookSync.findById(outlookSyncId, 'recentlyCreatedSeriesMasterEventsOutlookIds')
  const seriesMasterIds = [
    ...outlookSyncFound.recentlyCreatedSeriesMasterEventsOutlookIds || [],
    ...masterSeriesEventsToUpdateInOutlook.map(me => me.outlookId)
  ]

  const occurrenceEventsToInsert = []
  const occurrenceEventsBulkOps = []

  const outlookIdsToDelete = []
  const eventsToUpdate = []
  // const outlookEventsToUpdate = []

  loggerInfo({ seriesMasterIds, masterSeriesEventsToUpdateInOutlook })

  const masterEvents = await models.Event.find({
    projectId,
    deletedAt: null,
    outlookId: { $in: seriesMasterIds }
  });

  const masterEventsIds = masterEvents.map(e => String(e._id));

  const projectExceptionEvents = await models.Event.find({
    projectId,
    deletedAt: null,
    $or: [
      { seriesMasterId: { $in: seriesMasterIds }, },
      { seriesMasterId: { $in: masterEventsIds }, },
    ],
    type: OutlookEventTypes.EXCEPTION,

  });

  const projectOccurenceEvents = await models.Event.find({
    projectId,
    deletedAt: null,
    $or: [
      { seriesMasterId: { $in: seriesMasterIds }, },
      { seriesMasterId: { $in: masterEventsIds }, },
    ],
    type: OutlookEventTypes.OCCURRENCE
  });

  loggerInfo({
    masterEvents,
    masterEventsIds,
    projectExceptionEvents
  })

  for (const seriesMasterId of seriesMasterIds) {

    const occurrenceEventsInOutlook = await getOccurrenceSeriesEvent({
      accessToken, models, projectId, refreshToken, seriesMasterId
    })

    const masterEvent = masterEvents.find(me => me.outlookId === seriesMasterId)
    const fromOutlook = Boolean(masterEvent.fromOutlook)
    const masterEventCategoryId = masterEvent.categoryId

    const exceptionEvents = projectExceptionEvents.filter(ee =>
      fromOutlook
        ? ee.seriesMasterId === seriesMasterId
        : ee.seriesMasterId === masterEvent.id
    )
    const occurrenceEventsInDb = projectOccurenceEvents.filter(ee =>
      fromOutlook
        ? ee.seriesMasterId === seriesMasterId
        : ee.seriesMasterId === masterEvent.id
    )

    loggerInfo({
      fromOutlook, seriesMasterId, masterEvent,
      occurrenceEvents: occurrenceEventsInOutlook,
      exceptionEvents
    })

    // await models.Event.deleteMany({
    //   projectId,
    //   fromOutlook: { $ne: true },
    //   type: OutlookEventTypes.OCCURRENCE,
    //   seriesMasterId: masterEvent._id,
    //   outlookId: null,
    // })

    for (const event of occurrenceEventsInOutlook) {
      const dbExpEventMatched = exceptionEvents.find(e => {
        const eStartUtc = moment.utc(e.start).format(dateComparingFormat);
        const eventStartUtc = moment.utc(event.start).format(dateComparingFormat);
        const isDateSameUtc = moment(eStartUtc).isSame(eventStartUtc);

        loggerInfo('dbEventMatched', {
          eStartUtc,
          eventStartUtc,
          isDateSameUtc,
        })
        if (isDateSameUtc) return isDateSameUtc

        const eStart = momentTz(e.start).tz('UTC').format(dateComparingFormat);
        const eventStart = momentTz(event.start).tz(timeZone || defaultTimeZone).format(dateComparingFormat);

        const isDateSame = moment(eStart).isSame(eventStart);
        loggerInfo('dbEventMatched', {
          eStart,
          eventStart,
          isDateSame,
        })
        return isDateSame
      })

      const dbOccEventMatched = occurrenceEventsInDb.find(e => {
        loggerInfo('dbOccEventMatched occurrenceEventsInDb', {
          'e.start': e.start,
          'event.start': event.start,
        })
        const eStartUtc = moment.utc(e.start).format(dateComparingFormat);
        const eventStartUtc = moment.utc(event.start).format(dateComparingFormat);
        const isDateSameUtc = moment(eStartUtc).isSame(eventStartUtc);

        loggerInfo('dbOccEventMatched', {
          eStartUtc,
          eventStartUtc,
          isDateSameUtc,
        })
        if (isDateSameUtc) return isDateSameUtc

        const eStart = momentTz(e.start).tz('UTC').format(dateComparingFormat);
        const eventStart = momentTz(event.start).tz(timeZone || defaultTimeZone).format(dateComparingFormat);

        const isDateSame = moment(eStart).isSame(eventStart);
        loggerInfo('dbOccEventMatched', {
          eStart,
          eventStart,
          isDateSame,
        })
        return isDateSame
      })

      loggerInfo({
        dbExpEventMatched: JSON.stringify(dbExpEventMatched),
        dbOccEventMatched: JSON.stringify(dbOccEventMatched),
        masterEventCategoryId
      })

      // update event if there is an exception event matched
      if (dbExpEventMatched) {

        loggerInfo({
          'dbEventMatched.deletedAt': dbExpEventMatched.deletedAt
        })

        const isExceptionUpdatedAlready = matchedExceptionEventIds.find(eId => String(eId) === String(dbExpEventMatched.id))

        if (!Boolean(dbExpEventMatched.deletedAt)) {
          if (!isExceptionUpdatedAlready) {
            eventsToUpdate.push({
              event: dbExpEventMatched,
              outlookId: event.outlookId
            })
          }
        } else {
          outlookIdsToDelete.push(event.outlookId)
        }

        if (!isExceptionUpdatedAlready) {
          occurrenceEventsBulkOps.push({
            updateOne: {
              filter: { _id: mongoose.Types.ObjectId(dbExpEventMatched.id) },
              update: { outlookId: event.outlookId }
            }
          })
        }

      } else if (dbOccEventMatched) {
        occurrenceEventsBulkOps.push({
          updateOne: {
            filter: { _id: mongoose.Types.ObjectId(dbOccEventMatched.id) },
            update: {
              outlookId: event.outlookId,
              categoryId: masterEventCategoryId,
            }
          }
        })
      } else {
        const outlookIdExist = occurrenceEventsToInsert.find(e => e.outlookId === event.outlookId)
        if (!outlookIdExist) {
          occurrenceEventsToInsert.push({
            start: event.start + 'Z',
            end: event.end + 'Z',

            seriesMasterId: masterEvent._id,
            outlookId: event.outlookId,
            type: event.type,
            projectId,
            fromOutlook: false,
            createdAt: masterEvent.createdAt,
            updatedAt: new Date(),

            title: masterEvent.title || ' ',
            location: masterEvent.location,
            notes: masterEvent.notes,
            userIds: masterEvent.userIds,

            isAllDay: Boolean(masterEvent.isAllDay),
            categoryId: masterEvent.categoryId,
            isRecurrenceEditable: masterEvent.isRecurrenceEditable,

            showAs: event.showAs,
            sensitivity: event.sensitivity,
          })
        }
      }

    }

  }

  loggerInfo({
    occurrenceEventsToInsert,
    outlookIdsToDelete,
    eventsToUpdate,
    occurrenceEventsToInsert: JSON.stringify(occurrenceEventsToInsert),
    occurrenceEventsBulkOps: JSON.stringify(occurrenceEventsBulkOps),
  })


  await models.Event.insertMany(occurrenceEventsToInsert)
  await models.Event.bulkWrite(occurrenceEventsBulkOps)

  // for (const outlookId of outlookIdsToDelete) {
  //   await deleteOutlookEvent(client, outlookId)
  // }

  await deleteOutlookEvents20PerBatch(client, outlookIdsToDelete)


  for (const eventItem of eventsToUpdate) {
    loggerInfo({
      eventItemEvent: eventItem.event
    })
    const formattedEvent = formatEventToOutlook(eventItem.event, timeZone, projectCategories)
    const updatedEvent = await updateOutlookEvent(
      client,
      eventItem.outlookId,
      formattedEvent,
      projectCategories
    )

    loggerInfo({ updatedEvent })
  }

}

module.exports = {
  saveOutlookIdsOfOccurrenceEvents
}
