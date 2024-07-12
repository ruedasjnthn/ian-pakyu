const { getClientWithUpdateToken } = require("../../helper/AuthHelper");
const { loggerInfo, loggerError } = require("../../config/logger");
const { batchUpdateOutlookEvent, getEventInOutlookBatch, createCalendarEvent, updateOutlookEvent } = require("../../helper/OutlookEventHelper");
const { formatEventToOutlook } = require("../../helper/EventHelper");
const { getProjectCategories } = require("../../helper/CategoryHelper");
const { defaultTimeZone } = require("../../constants/calendar");
const { getFolderMessages, getMailFolderFilterName } = require("../../helper/OutlookMailFolderHelper");
const { getOutlookMail } = require("../../helper/OutlookMailHelper");
const { getOutlookContactsFirstTime, getOutlookContactsChanges } = require("../../helper/OutlookContactHelper");
const mongoose = require("mongoose");
const { CalendarRangeFilter, CalendarSyncRange } = require("../../constants/outlook");

const getOutlookApiResults = async (_, { link, projectId }, { models }) => {
  try {
    const projectFound = await models.Project.findById(projectId)
    const { accessToken, refreshToken, calendarId } = projectFound && projectFound.outlook || {}
    const client = await getClientWithUpdateToken({ accessToken, refreshToken, models, projectId })

    // const results = await client.api(link).get();
    const projectCategories = await getProjectCategories({ projectId })

    // const ev = await models.Event.findById("642e86f29b3354d2b8c568d0")
    // const ev2 = await models.Event.findById("641f9ddc56b0e83b360f53d2")
    // const outlookEvents = [
    //   { id: "63f9eff54d4e436ccad7eae6", ...formatEventToOutlook(ev, defaultTimeZone, projectCategories), },
    //   { id: "641f9ddc56b0e83b360f53d2", ...formatEventToOutlook(ev2, defaultTimeZone, projectCategories), }
    // ]


    // const results = await batchCreateCalendarEvent(client, calendarId, outlookEvents)
    // loggerInfo('deltaLink', {
    //   results,
    //   resultsJSON: JSON.stringify(results),
    //   outlookEvents: JSON.stringify(outlookEvents)
    // })

    // const occurenceEvents = await getOccurrenceSeriesEvent({
    //   accessToken,
    //   models,
    //   projectId,
    //   refreshToken,
    //   seriesMasterId: 'AAMkADJmMGZmMzk1LTM0MWYtNDBhMy05MzI5LWY1NjFhM2U4NjFjOQBGAAAAAAAI-XzXZfxXRqotEqSV6lzMBwCwwIhiyifRQJ9xWW2dxbU4AAD06BLlAACwwIhiyifRQJ9xWW2dxbU4AAD06b66AAA=',
    //   projectCategories
    // })

    // loggerInfo('getOccurrenceSeriesEvent', { occurenceEvents })

    // const outlookIds = ['AAMkAGZjYzAyZjAyLTMyMDEtNDlhYS1hMDk3LWMyOTA1ZDFhYWRlMQBGAAAAAAB9cH2nn6GnQrrZ6CfmJcvgBwAkCZ2U9lCUSZ3WrQH4jiMIAAAAAAENAAAkCZ2U9lCUSZ3WrQH4jiMIAAAi5OCVAAA=']
    // const res =  await batchDeleteOutlookEvent(client, outlookIds)
    // const outlookId = 'AAMkADJmMGZmMzk1LTM0MWYtNDBhMy05MzI5LWY1NjFhM2U4NjFjOQBGAAAAAAAI-XzXZfxXRqotEqSV6lzMBwCwwIhiyifRQJ9xWW2dxbU4AAD06BLlAACwwIhiyifRQJ9xWW2dxbU4AAD06b60AAA='
    // const outlookEvents = [
    //   {
    //     id: outlookId,
    //     ...formatEventToOutlook(ev, defaultTimeZone, projectCategories),
    //     subject: 'ok updated 3',
    //   },
    //   // { id: "641f9ddc56b0e83b360f53d2", ...formatEventToOutlook(ev2, defaultTimeZone, projectCategories), }
    // ]
    // loggerInfo({ outlookEvents: JSON.stringify(outlookEvents) })

    // const updateEvents = await batchUpdateOutlookEvent(client, outlookEvents, projectCategories)
    // loggerInfo({ updateEvents })

    // const expiration = {
    //   expirationDateTime: new Date(Date.now() + 253800000).toISOString(),
    // };
    // const subs = await client
    //   .api(`/subscriptions/a608c000-276d-45a5-896d-b010550b1af4`)
    //   .update(expiration); 

    // console.log({
    //   subs
    // })
    // const folderId = "AAMkAGZjYzAyZjAyLTMyMDEtNDlhYS1hMDk3LWMyOTA1ZDFhYWRlMQAuAAAAAAB9cH2nn6GnQrrZ6CfmJcvgAQAkCZ2U9lCUSZ3WrQH4jiMIAAAAAAEMAAA="
    // const folderId = "AAMkAGZjYzAyZjAyLTMyMDEtNDlhYS1hMDk3LWMyOTA1ZDFhYWRlMQAuAAAAAAB9cH2nn6GnQrrZ6CfmJcvgAQAkCZ2U9lCUSZ3WrQH4jiMIAAA1ukFMAAA="

    // const inboxFOlderName = 'Inbox'
    // const inboxFolder = await getMailFolderFilterName(client, inboxFOlderName)

    // const msgs = await getFolderMessages(client, folderId)
    // // const msgs = await getMe(client, inboxFolder.id)
    // // const messageId = "AAMkAGZjYzAyZjAyLTMyMDEtNDlhYS1hMDk3LWMyOTA1ZDFhYWRlMQBGAAAAAAB9cH2nn6GnQrrZ6CfmJcvgBwAkCZ2U9lCUSZ3WrQH4jiMIAAAAAAEMAAAkCZ2U9lCUSZ3WrQH4jiMIAAA3UrCQAAA="
    // const messageId = "AAkALgAAAAAAHYQDEapmEc2byACqAC-EWg0AJAmdlPZQlEmd1q0B_I4jCAAAN1K0eAAA"
    // const mail = await getOutlookMail(client, projectId, messageId)

    // console.log({
    //   mail,
    //   // inboxFolder,
    //   // msgsLength: msgs.length,
    //   // msgs
    // })

    // await getSingleInstanceEvent({ client, calendarId })
    const event = formatEventToOutlook({
      "_id": "647759dafb259b614a971c4f",
      "projectId": "6463964f10506fd35a181cdb",
      "title": "series ..........!",
      "start": "2023-05-07T22:00:00.000Z",
      "end": "2023-05-07T22:30:00.000Z",
      "isAllDay": false,
      "location": "",
      "notes": "",
      "categoryId": "63eb5f389edbe1140f938692",
      "seriesMasterId": "AAMkAGZjYzAyZjAyLTMyMDEtNDlhYS1hMDk3LWMyOTA1ZDFhYWRlMQBGAAAAAAB9cH2nn6GnQrrZ6CfmJcvgBwAkCZ2U9lCUSZ3WrQH4jiMIAAA9pBsXAAAkCZ2U9lCUSZ3WrQH4jiMIAABIOZTHAAA=",
      "type": "occurrence",
      "createdAt": "2023-05-31T10:28:54.212Z",
      "updatedAt": "2023-06-01T03:59:31.234Z",
      "fromOutlook": false,
      "isRecurrenceEditable": true,
      "userIds": [],
      "sensitivity": "normal",
      "showAs": "busy",
      // "outlookId": "AAMkAGZjYzAyZjAyLTMyMDEtNDlhYS1hMDk3LWMyOTA1ZDFhYWRlMQFRAAgI209XKrBAAEYAAAAAfXB9p5_hp0K62egn5iXL4AcAJAmdlPZQlEmd1q0B_I4jCAAAPaQbFwAAJAmdlPZQlEmd1q0B_I4jCAAASDmUxwAAEA==",
      "originId": "647759dafb259b614a971c4f",
    }, defaultTimeZone, projectCategories)
    loggerInfo('getOutlookApiResults event', { event })
    const id = "AAMkAGZjYzAyZjAyLTMyMDEtNDlhYS1hMDk3LWMyOTA1ZDFhYWRlMQFRAAgI209XKrBAAEYAAAAAfXB9p5_hp0K62egn5iXL4AcAJAmdlPZQlEmd1q0B_I4jCAAAPaQbFwAAJAmdlPZQlEmd1q0B_I4jCAAASDmUxwAAEA=="

    // const createdEvent = await createCalendarEvent(client, event, calendarId)
    const updatedEvent = await updateOutlookEvent(client, id, event, calendarId)
    loggerInfo('getOutlookApiResults createdEvent', { updatedEvent })

    // const evs = await getEventInOutlookBatch(client, [
    //   "AAMkAGZjYzAyZjAyLTMyMDEtNDlhYS1hMDk3LWMyOTA1ZDFhYWRlMQFRAAgI20qgLDXAAEYAAAAAfXB9p5_hp0K62egn5iXL4AcAJAmdlPZQlEmd1q0B_I4jCAAAPyIE5AAAJAmdlPZQlEmd1q0B_I4jCAAAPyIMwgAAEA==",
    //   "AAMkAGZjYzAyZjAyLTMyMDEtNDlhsS1hMDk3LWMyOTA1ZDFhYWRlMQFRAAgI23N8ybDAAEYAAAAAfXB9p5_hp0K62egn5iXL4AcAJAmdlPZQlEmd1q0B_I4jCAAAPaQbFwAAJAmdlPZQlEmd1q0B_I4jCAAAPaTyfwAAEA=="
    // ])
    // console.log({
    //   evs
    // })
    return ''
  } catch (e) {
    loggerError('error', { e })
    return e
  }

}

module.exports = {
  getOutlookApiResults
}
