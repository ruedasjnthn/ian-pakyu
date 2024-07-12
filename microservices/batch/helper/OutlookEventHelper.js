require('isomorphic-fetch');
const moment = require('moment');
const { OutlookEventTypes, CalendarSyncRange } = require('../constants/outlook');
const { getClient, getClientWithUpdateToken } = require('./AuthHelper');
const { formatEventsFromOutlook, formatEventFromOutlook } = require('./EventHelper')
const { loggerInfo, loggerError } = require("../config/logger");


const getStartDateTime = () => CalendarSyncRange.getStart()
const getEndDateTime = () => CalendarSyncRange.getEnd()

const createCalendarEvent = async (client, outlookEvent, calendarId, projectCategories) => {
  try {
    const apiLink = calendarId ?
      `/me/calendars/${calendarId}/events`
      : '/me/events';

    const createdEvent = await client.api(apiLink)
      .version('v1.0')
      .select('type,subject,bodyPreview,start,end,location,isAllDay,lastModifiedDateTime,originalStartTimeZone,categories,createdDateTime,recurrence,sensitivity,showAs,seriesMasterId')
      .post(outlookEvent);
    loggerInfo('createdEvent', createdEvent)
    return createdEvent && formatEventFromOutlook(createdEvent, projectCategories)
  } catch (e) {
    loggerError('error createCalendarEvent', outlookEvent, { e })
    return null
  }
}

// outlookEvents must have a unique reqId
const batchCreateCalendarEvent = async (client, calendarId, outlookEvents, projectCategories) => {
  try {

    const requests = []

    for (const outlookEvent of outlookEvents) {
      const reqId = outlookEvent.reqId
      delete outlookEvent.reqId
      requests.push({
        "id": reqId,
        "method": "POST",
        "url": `/me/calendars/${calendarId}/events?$select=type,subject,bodyPreview,start,end,location,isAllDay,lastModifiedDateTime,originalStartTimeZone,categories,createdDateTime,recurrence,sensitivity,showAs,seriesMasterId`,
        "body": outlookEvent,
        "headers": {
          "Content-Type": "application/json"
        }
      })
    }

    loggerInfo('requests', JSON.stringify(requests))

    const response = await client.api('/$batch')
      .version('v1.0')
      .post({ "requests": requests })

    const createdEvents = []
    const responses = response['responses'] || []
    for (const res of responses) {
      // resId is equal reqId
      const resId = res['id']
      const resBody = res['body']
      const resError = resBody?.error
      const resEvent = resBody
      // const resValue = resBody && resBody['value']
      loggerInfo({
        resId,
        resBody,
        resError,
        resEvent
      })

      if (!resError) {
        const formattedEvent = formatEventFromOutlook(resEvent, projectCategories)
        loggerInfo({ formattedEvent })
        createdEvents.push({
          resId,
          ...formattedEvent
        })
      }
    }

    loggerInfo('createdEvent', {
      res: JSON.stringify(response),
      createdEvents: JSON.stringify(createdEvents)
    })
    return createdEvents
    // return createdEvent && formatEventFromOutlook(createdEvent, projectCategories)
  } catch (e) {
    loggerError('error batchCreateCalendarEvent', { e })
    return []
  }
}

const createOutlookEventsPerBatch = async (client, eventsToCreate, outlookCalendarId, projectCategories) => {
  const batch20Events = {};

  let batchCount = 1;
  let count = 1;
  for (const event of eventsToCreate) {
    batch20Events[batchCount] = [...batch20Events[batchCount] || [], event];

    if (count === 20) {
      count = 1;
      batchCount += 1;
    } else count += 1;
  }


  let createdEvents = []

  for (const batchNumber in batch20Events) {
    const eventBatch = batch20Events[batchNumber]
    const createdEventsResults = await batchCreateCalendarEvent(
      client,
      outlookCalendarId,
      eventBatch,
      projectCategories
    )

    createdEvents = [...createdEvents, ...createdEventsResults || []]
  }

  return createdEvents
}

// const getOutlookEvent = async (client, outlookEventId, calendarId) => {
//   try {
//     const apiLink = calendarId
//       ? `/me/calendargroups/${calendarId}/calendars/${calendarId}/events/${outlookEventId}`
//       : `/me/events/${outlookEventId}`;

//     const event = await client.api(apiLink)
//       .select('subject,bodyPreview,start,end,location,isAllDay,lastModifiedDateTime,originalStartTimeZone,categories,createdDateTime')
//       .get();
//     loggerInfo('getOutlookEvent event', event)
//     return formatEventFromOutlook(event)
//   } catch (e) {
//     return null
//   }
// }

// const getOutlookEvents = async (client, calendarId) => {
//   let events = []
//   const apiLink = calendarId
//     ? `/me/calendarGroups/${calendarId}/calendars/${calendarId}/events`
//     : '/me/events';
//   const results = await client.api(apiLink).get();
//   // loggerInfo({ results })
//   // events = results ? results.value : []

//   let nextLink = results['@odata.nextLink']
//   // loggerInfo({ nextLink })
//   while (nextLink) {
//     const nextResults = await client.api(nextLink).get();
//     events = [...events, ...nextResults ? nextResults.value : []]
//     nextLink = await nextResults['@odata.nextLink']
//     loggerInfo({ nextLink })
//   }
//   loggerInfo({ length: events.length })
//   return formatEventsFromOutlook(events);
// }

const getOutlookEventsToInitialize = async ({
  client,
  calendarId,
  nextLink,
  projectCategories,
  models,
  outlookSyncId,
  projectId
}) => {
  try {
    const limit = 1000;
    let events = [];

    const startDateTime = CalendarSyncRange.getStart()
    const endDateTime = CalendarSyncRange.getEnd()
    // const startDateTime = moment().subtract(1, 'year').toISOString();
    // const endDateTime = moment().add(2, 'year').toISOString();
    loggerInfo({ startDateTime, endDateTime })

    let apiLink = calendarId
      ? `/me/calendarGroups/${calendarId}/calendars/${calendarId}/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$count=true&$top=${limit}`
      : `/me/events?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$count=true&$top=${limit}`

    if (nextLink !== undefined) apiLink = nextLink
    const startT1 = Date.now()
    const results = await client.api(apiLink).get();
    events = results
      ? formatEventsFromOutlook(results.value || [], projectCategories)
      : []

    // await models.OutlookSync.updateOne(
    //   { _id: outlookSyncId, projectId },
    //   {
    //     $addToSet: {
    //       events: {
    //         $each: events,
    //       }
    //     },
    //   }
    // )
    loggerInfo({ nextLink })

    let totalCount, newNextLink;
    if (results) {
      totalCount = results['@odata.count']
      newNextLink = results['@odata.nextLink']
    }
    loggerInfo({ nextLink, newNextLink, eventsL: events.length, totalCount })
    loggerInfo({ time: (Date.now() - startT1) / 1000 + 's' })

    let loopCount = 0;

    while (newNextLink) {
      loggerInfo('fetcing next line')

      const startT = Date.now()
      let nextResults;
      try {
        nextResults = await client.api(newNextLink).get();
        loggerInfo('done fetching')
        // await models.OutlookSync.updateOne(
        //   { _id: outlookSyncId, projectId },
        //   {
        //     $addToSet: {
        //       events: {
        //         $each: nextResults ? formatEventsFromOutlook(nextResults.value) : [],
        //       }
        //     },
        //   }
        // )
      } catch (e) {
        loggerError('err fetching', { e })
      }
      events = [...events, ...nextResults
        ? formatEventsFromOutlook(nextResults.value, projectCategories)
        : []
      ]
      newNextLink = await nextResults && nextResults['@odata.nextLink']

      const endT = Date.now()
      loopCount += 1;

      loggerInfo('done fetch', { nextLink, newNextLink, eventsL: events.length, totalCount, loopCount })
      loggerInfo({ time: (endT - startT) / 1000 + 's' })
    }

    return {
      newNextLink,
      outlookEventsResult: events
    }
  } catch (e) {
    loggerError('get eves err', { e })
    return {
      newNextLink: null,
      outlookEventsResult: null
    }
  }
}

const getOutlookEventsFirstTime = async ({
  client,
  calendarId,
  nextLink,
  projectCategories,
}) => {
  try {
    const startTime = Date.now()
    const limit = 300;

    const startDateTime = CalendarSyncRange.getStart()
    const endDateTime = CalendarSyncRange.getEnd()
    // const startDateTime = moment().subtract(1, 'year').startOf('year').toISOString();
    // const endDateTime = moment().add(2, 'year').endOf('year').toISOString();

    loggerInfo({ startDateTime, endDateTime })

    let apiLink;

    if (nextLink)
      apiLink = nextLink
    else
      apiLink = calendarId
        ? `/me/calendarGroups/${calendarId}/calendars/${calendarId}/calendarView/delta?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$count=true`
        : `/me/events?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$count=true&$top=${limit}`

    loggerInfo({ apiLink })
    loggerInfo('...fetching...')

    let results;

    if (nextLink) results = await client.api(apiLink)
      .version('v1.0')
      .get();
    else
      results = await client.api(apiLink)
        .header('Prefer', `odata.maxpagesize=${limit}`)
        .version('v1.0')
        .select('type,subject,bodyPreview,start,end,location,isAllDay,lastModifiedDateTime,originalStartTimeZone,categories,createdDateTime,recurrence,sensitivity,showAs,seriesMasterId')
        .get();

    loggerInfo({ resultsValues: results.value })

    let resultsValue = []

    let newNextLink, deltaLink;

    if (results) {
      resultsValue = results.value || []
      newNextLink = results['@odata.nextLink']
      deltaLink = results['@odata.deltaLink']
    }

    const events = formatEventsFromOutlook(resultsValue, projectCategories)
    const seriesMasterEvents = events.filter(event => event.type === OutlookEventTypes.SERIES_MASTER)

    loggerInfo({ seriesMasterEvents })
    loggerInfo({ resultsValueLength: resultsValue.length })
    loggerInfo({ nextLink, newNextLink, deltaLink, eventsLength: events.length })
    loggerInfo({ time: (Date.now() - startTime) / 1000 + 's' })

    return {
      newNextLink,
      deltaLink,
      outlookEventsResult: events,
      seriesMasterEvents,
    }
  } catch (e) {
    loggerError('init err', { e })
    return e
    // return {
    //   newNextLink: nextLink,
    //   outlookEventsResult: []
    // }
  }
}

const getOutlookEventsChanges = async ({
  client,
  apiLink,
  projectCategories,
}) => {
  try {
    const startTime = Date.now()

    loggerInfo({ apiLink })

    const results = await client.api(apiLink).version('v1.0').get();
    const resultsValues = results && results.value || [];

    loggerInfo({
      resultsValues: JSON.stringify(resultsValues),
    })
    const outlookEventIdsDeleted = resultsValues.filter(event => Boolean(event['@removed'])).map(e => e.id)

    const notRemovedEvents = resultsValues.filter(event => !event['@removed'])

    const outlookEventsUpdated = formatEventsFromOutlook(notRemovedEvents, projectCategories)

    const seriesMasterEvents = []
    const seriesOccurrenceEvents = []
    const singleEventsUpdated = []

    for (const event of outlookEventsUpdated) {
      switch (event.type) {
        case OutlookEventTypes.SERIES_MASTER:
          seriesMasterEvents.push(event)
          singleEventsUpdated.push(event)
          break;
        case OutlookEventTypes.OCCURRENCE:
          seriesOccurrenceEvents.push(event)
          break;
        case OutlookEventTypes.SINGLE_INSTANCE:
        case OutlookEventTypes.EXCEPTION:
        default:
          singleEventsUpdated.push(event)
          break;
      }
    }

    loggerInfo({
      outlookEventIdsDeleted,
      singleEventsUpdated,
      seriesMasterEvents,
      seriesOccurrenceEvents,
      resultsValuesLength: resultsValues.length
    })

    let totalCount, newNextLink, newDeltaLink;

    if (results) {
      totalCount = results['@odata.count']
      newNextLink = results['@odata.nextLink']
      newDeltaLink = results['@odata.deltaLink']
    }

    loggerInfo({ newDeltaLink, newNextLink, totalCount })
    loggerInfo({ time: (Date.now() - startTime) / 1000 + 's' })

    return {
      newNextLink,
      newDeltaLink,
      outlookEventIdsDeleted,
      singleEventsUpdated,
      seriesMasterEvents,
      seriesOccurrenceEvents
    }
  } catch (e) {
    loggerError('init err', { e })
    return e
    // return {
    //   newNextLink: nextLink,
    //   outlookEventsResult: []
    // }
  }
}

const getOutlookCalendars = async (client, selectedCalendarIds) => {
  let calendars = []
  const results = await client.api('/me/calendars?$top=100').get();
  loggerInfo({ calendars: results })
  calendars = results ? results.value : []

  let nextLink = results['@odata.nextLink']
  while (nextLink) {
    const nextResults = await client.api(nextLink).get();
    calendars = [...calendars, ...nextResults ? nextResults.value : []]
    nextLink = nextResults['@odata.nextLink']
  }

  return calendars.map(c => ({
    id: c.id,
    name: c.name,
    isDefaultCalendar: c.isDefaultCalendar,
    isSelected: selectedCalendarIds.includes(c.id)
  }))
}

const updateOutlookEvent = async (client, id, event, projectCategories) => {
  try {
    let resId
    if (event.reqId) {
      resId = event.reqId
      delete event.reqId
    }
    if (event.outlookId) delete event.outlookId
    let updatedEvent = await client.api(`/me/events/${id}`)
      .version('v1.0')
      .select('type,subject,bodyPreview,start,end,location,isAllDay,lastModifiedDateTime,originalStartTimeZone,categories,createdDateTime,recurrence,sensitivity,showAs,seriesMasterId')
      .update(event)
    loggerInfo('updateOutlookEvent', { updatedEvent })
    return {
      ...formatEventFromOutlook(updatedEvent, projectCategories),
      resId
    }
  } catch (e) {
    loggerError('updateOutlookEvent Error:', { e })
    return null
  }
}

const batchUpdateOutlookEvent = async (client, outlookEvents, projectCategories) => {
  try {

    const requests = []

    for (const outlookEvent of outlookEvents) {
      const reqId = outlookEvent.reqId
      const outlookId = outlookEvent.outlookId
      delete outlookEvent.reqId
      delete outlookEvent.outlookId
      requests.push({
        "id": reqId,
        "method": "PATCH",
        "url": `/me/events/${outlookId}?$select=type,subject,bodyPreview,start,end,location,isAllDay,lastModifiedDateTime,originalStartTimeZone,categories,createdDateTime,recurrence,sensitivity,showAs,seriesMasterId`,
        "body": outlookEvent,
        "headers": {
          "Content-Type": "application/json"
        }
      })
    }

    loggerInfo('requests', JSON.stringify(requests))

    const response = await client.api('/$batch')
      .version('v1.0')
      .post({ "requests": requests })

    const updatedEvents = []
    const responses = response['responses'] || []
    for (const res of responses) {
      const resId = res['id']
      const resBody = res['body']
      const resError = resBody?.error
      const resEvent = resBody
      loggerInfo({
        resId,
        resBody,
        resError,
        resEvent,
      })
      // const resValue = resBody && resBody['value']

      if (!resError) {
        const formattedEvent = formatEventFromOutlook(resEvent, projectCategories)
        loggerInfo({ resEvent, formattedEvent })
        updatedEvents.push({
          resId,
          ...formattedEvent
        })
      }
    }

    loggerInfo('updatedEvents', {
      res: JSON.stringify(response),
      updatedEvents: JSON.stringify(updatedEvents)
    })
    return updatedEvents
    // return createdEvent && formatEventFromOutlook(createdEvent, projectCategories)
  } catch (e) {
    loggerError('error batchUpdateOutlookEvent', { e })
    return []
  }
}

const updateOutlookEventsPerBatch = async (client, eventsToUpdate, projectCategories) => {
  const updateBatch20Events = {};

  let updateBatchCount = 1;
  let updateCount = 1;

  for (const event of eventsToUpdate) {
    updateBatch20Events[updateBatchCount] =
      [...updateBatch20Events[updateBatchCount] || [], event];

    if (updateCount === 2) {
      updateCount = 1;
      updateBatchCount += 1;
    } else updateCount += 1;
  }

  let updatedEvents = []

  for (const batchNumber in updateBatch20Events) {
    const eventBatch = updateBatch20Events[batchNumber]
    const updatedEventsResults = await batchUpdateOutlookEvent(
      client,
      eventBatch,
      projectCategories
    )
    updatedEvents = [
      ...updatedEvents,
      ...updatedEventsResults || []
    ]
  }

  return updatedEvents
}

const deleteOutlookEvent = async (client, id) => {
  try {
    await client.api(`/me/events/${id}`).delete();
    return true
  } catch (e) {
    loggerError('deleteOutlookEvent Error:', { e })
    return false
  }
}

// request can only have 20 items
const batchDeleteOutlookEvent = async (client, outlookEventIds) => {
  try {

    const requests = []

    for (const outlookEventId of outlookEventIds) {
      requests.push({
        "id": outlookEventId,
        "method": "DELETE",
        "url": `/me/events/${outlookEventId}`,
      })
    }

    loggerInfo('requests', JSON.stringify(requests))
    const response = await client.api('/$batch')
      .version('v1.0')
      .post({ "requests": requests })

    const responses = response['responses'] || []
    const deletedEventsOutlookIds = new Set()

    for (const res of responses) {
      const resId = res['id']
      const resBody = res['body']
      const resError = resBody?.error
      if (!resError) deletedEventsOutlookIds.add(resId)
    }

    loggerInfo('deletedEventsOutlookIds', {
      res: JSON.stringify(response),
      deletedEventsOutlookIds,
      arr: [...new Set(deletedEventsOutlookIds)]
    })

    return [...deletedEventsOutlookIds]

  } catch (e) {
    loggerError('error batchDeleteOutlookEvent', { e })
    return []
  }
}

const deleteOutlookEvents20PerBatch = async (client, outlookIdsToDelete) => {
  const batch20OutlookIds = {};

  let batchCount = 1;
  let count = 1;

  const idArray = [...new Set(outlookIdsToDelete)]
  for (const outlookId of idArray) {
    batch20OutlookIds[batchCount] = [...batch20OutlookIds[batchCount] || [], outlookId];

    if (count === 20) {
      count = 1;
      batchCount += 1;
    } else count += 1;
  }

  let deletedEventsOutlookIds = []

  for (const batchNumber in batch20OutlookIds) {
    const deletedEventsOutlookIdsResults = await batchDeleteOutlookEvent(client, batch20OutlookIds[batchNumber])
    deletedEventsOutlookIds = [...deletedEventsOutlookIds, ...deletedEventsOutlookIdsResults || []]
  }

  return [...new Set(deletedEventsOutlookIds)]
}


// const isEventExisting = async (token, refreshToken, id) => {
//   try {
//     const client = await getClient(token, refreshToken);
//     let event = await client.api(`/me/events/${id}`).select('subject').get();
//     return Boolean(event)
//   } catch (e) {
//     return false
//   }
// }

const getEvent = async (token, refreshToken, id) => {
  try {
    const client = await getClient(token, refreshToken);
    let event = await client.api(`/me/events/${id}`).get();
    return event
  } catch (e) {
    return false
  }
}

const getOccurrenceSeriesEvent = async ({ accessToken, models, projectId, refreshToken, seriesMasterId, projectCategories }) => {
  try {
    const client = await getClientWithUpdateToken({ accessToken, models, projectId, refreshToken });

    const startDate = getStartDateTime();
    const endDate = getEndDateTime();

    const link = `/me/events/${seriesMasterId}/instances?startDateTime=${startDate}&endDateTime=${endDate}&$type=occurence&$top=500`;
    const results = await client.api(link)
      .version('v1.0')
      .select('type,subject,bodyPreview,start,end,location,isAllDay,lastModifiedDateTime,originalStartTimeZone,categories,createdDateTime,recurrence,sensitivity,showAs,seriesMasterId')
      .get();

    let occurenceEvents = []

    if (results) {
      const resultsValues = results && results.value || [];
      let nextLink = results['@odata.nextLink']
      occurenceEvents = formatEventsFromOutlook(resultsValues, projectCategories)
      loggerInfo({ results, nextLink })

      while (nextLink) {
        const nextResults = await client.api(nextLink).get();
        const nextResultsValues = nextResults && nextResults.value || [];

        occurenceEvents = [...occurenceEvents, ...formatEventsFromOutlook(nextResultsValues, projectCategories)]
        nextLink = await nextResults['@odata.nextLink']
        loggerInfo({ nextResults, nextLink })
      }

    }

    loggerInfo({
      occurenceEventsLength: occurenceEvents.length
    })

    return occurenceEvents
  } catch (e) {
    loggerError('getOccurrenceSeriesEvent', { e })
    return []
  }
}

const getOccurrenceSeriesEventParts = async ({
  nextLink,
  seriesMasterId,
  projectCategories,
  client
}) => {
  try {

    const startDate = getStartDateTime();
    const endDate = getEndDateTime();


    let results;

    if (nextLink) {

      const link = nextLink
      results = await client.api(link)
        .version('v1.0')
        .get();

    } else {
      const link = `/me/events/${seriesMasterId}/instances?startDateTime=${startDate}&endDateTime=${endDate}&$type=occurence&$top=150`;

      results = await client.api(link)
        .version('v1.0')
        .select('type,subject,bodyPreview,start,end,location,isAllDay,lastModifiedDateTime,originalStartTimeZone,categories,createdDateTime,recurrence,sensitivity,showAs,seriesMasterId')
        .get();
    }

    const resultsValues = results && results.value || [];
    const newNextLink = results['@odata.nextLink']

    const occurenceEvents = formatEventsFromOutlook(resultsValues, projectCategories)

    loggerInfo({
      results,
      newNextLink,
      occurenceEventsLength: occurenceEvents.length
    })

    return {
      occurenceEvents,
      newNextLink
    }
  } catch (e) {
    loggerError('getOccurrenceSeriesEvent', { e })
    return {
      occurenceEvents: [],
      newNextLink: null
    }
  }
}

// request can only have 20 items
const batchGetOutlookEventById = async (client, outlookEventIds, projectCategories) => {
  try {

    const requests = []

    for (const outlookEventId of outlookEventIds) {
      requests.push({
        "id": outlookEventId,
        "method": "GET",
        "url": `/me/events/${outlookEventId}?$select=type,subject,bodyPreview,start,end,location,isAllDay,lastModifiedDateTime,originalStartTimeZone,categories,createdDateTime,recurrence,sensitivity,showAs,seriesMasterId`,
      })
    }

    loggerInfo('requests', JSON.stringify(requests))

    const response = await client.api('/$batch')
      .version('v1.0')
      .post({ "requests": requests })

    const events = []
    const responses = response['responses'] || []
    for (const res of responses) {
      // resId is equal reqId
      const resId = res['id']
      const resBody = res['body']
      const resError = resBody?.error
      const resEvent = resBody
      // const resValue = resBody && resBody['value']
      loggerInfo({
        resId,
        resBody,
        resError,
        resEvent,
      })

      if (!resError) {
        const formattedEvent = formatEventFromOutlook(resEvent, projectCategories)
        loggerInfo({ resEvent, formattedEvent })
        events.push({
          resId,
          ...Boolean(formattedEvent)
            ? formattedEvent
            : { eventNotFound: true }
        })
      }
    }

    loggerInfo('batchGetOutlookEventById', {
      res: JSON.stringify(response),
      events: JSON.stringify(events)
    })
    return events
  } catch (e) {
    loggerError('error batchDeleteOutlookEvent', { e })
    return []
  }
}

const getEventInOutlookBatch = async (client, outlookEventIds, projectCategories) => {
  try {
    const outlookIdBatches = {};

    let batchCount = 1;
    let count = 1;

    const idArray = [...new Set(outlookEventIds)]
    for (const outlookId of idArray) {
      outlookIdBatches[batchCount] = [...outlookIdBatches[batchCount] || [], outlookId];

      if (count === 20) {
        count = 1;
        batchCount += 1;
      } else count += 1;
    }

    let events = []

    for (const batchNumber in outlookIdBatches) {
      const eventsReults = await batchGetOutlookEventById(client, outlookIdBatches[batchNumber], projectCategories)
      events = [...events, ...eventsReults]
    }

    return events
  } catch (e) {
    return []
  }
}

module.exports = {
  createCalendarEvent,
  // getOutlookEvents,
  getOutlookCalendars,
  getOutlookEventsToInitialize,
  updateOutlookEvent,
  deleteOutlookEvent,
  getOutlookEventsFirstTime,
  getOutlookEventsChanges,
  // getOutlookEvent,
  getEvent,
  getOccurrenceSeriesEvent,
  batchCreateCalendarEvent,
  batchDeleteOutlookEvent,
  deleteOutlookEvents20PerBatch,
  batchUpdateOutlookEvent,
  getOccurrenceSeriesEventParts,
  getEventInOutlookBatch,
  updateOutlookEventsPerBatch,
  createOutlookEventsPerBatch
};
