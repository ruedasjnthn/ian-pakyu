const moment = require("moment");
const momentTz = require("moment-timezone");
const mongoose = require("mongoose");
const { RecurrenceTypes, OutlookEventTypes } = require("../constants/outlook");
const { getCategoryNameArray, getCategoryId, getIssueEventCategoryNameArray } = require("./SyncHelper");
const { loggerInfo, loggerError } = require("../config/logger");
const { dateFormat } = require("../constants/calendar");

const allDayDateFormat = 'YYYY-MM-DD';
const defaultTimeZone = 'Europe/Berlin';
// const timeZone = tz.guess()

// format calendar events fetched from outlook to match 
// structure of an event from the DB
const formatEventFromOutlook = (event, projectCategories = []) => {
  try {
    if (event === null) return null

    const timeZone = event.originalStartTimeZone;
    const startDateTime = event.start.dateTime;
    const endDateTime = event.end.dateTime;
    const outlookCategoryName = event.categories && event.categories[0]

    const categoryId = getCategoryId(projectCategories, outlookCategoryName)

    loggerInfo('formatEventFromOutlook', event.subject, {
      startDateTime,
      endDateTime,
      timeZone,
      evcateg: event.categories,
      recurrence: event.recurrence,
      outlookCategoryName,
      projectCategoriesLength: projectCategories && projectCategories.length,
      sensitivity: event.sensitivity,
      showAs: event.showAs,
      categoryId
    })
    const isRecurrenceEditable = getIsRecurrenceEditable(event.recurrence)
    loggerInfo(event.subject, isRecurrenceEditable)
    const isSeriesMasterEvent = event.type === OutlookEventTypes.SERIES_MASTER

    return {
      title: event.subject,
      start: startDateTime + 'Z',
      end: endDateTime + 'Z',
      isAllDay: Boolean(event.isAllDay),
      location: event.location && event.location.displayName,
      notes: event.bodyPreview,
      outlookId: event.id,
      lastModifiedDateTime: event.lastModifiedDateTime,
      timeZone,
      categoryId,
      fromOutlook: true,
      seriesMasterId: event.seriesMasterId,
      type: event.type,
      ...event.recurrence && isSeriesMasterEvent && {
        recurrence: {
          ...event.recurrence,
          ...event.recurrence.range && {
            range: {
              ...event.recurrence.range,
              ...event.recurrence.range.recurrenceTimeZone === "Customized Time Zone" &&
              { recurrenceTimeZone: 'W. Europe Standard Time' }
            }
          }
        },
      },
      isRecurrenceEditable,
      sensitivity: event.sensitivity,
      showAs: event.showAs,
    }
  } catch (e) {
    loggerError('formatEventFromOutlook err: ', event, { e })
    return null
  }
}

const getIsRecurrenceEditable = (recurrence) => {
  if (!recurrence) return false
  const { pattern, range } = recurrence
  // if (range.type !== RecurrenceRangeType.END_DATE) return false
  switch (pattern.type) {
    case RecurrenceTypes.WEEKLY:
      return pattern.daysOfWeek.length === 1
    case RecurrenceTypes.ABSOLUTE_MONTHLY:
      return Boolean(pattern.dayOfMonth)
    case RecurrenceTypes.ABSOLUTE_YEARLY:
      return Boolean(pattern.dayOfMonth) && Boolean(pattern.month)
    case RecurrenceTypes.DAILY:
      return true
    default:
      return false
  }
}

const formatEventsFromOutlook = (events = [], projectCategories) => events
  .map(event => formatEventFromOutlook(event, projectCategories))
  .filter(event => Boolean(event))

// format events from the DB to match the structure
// of a calendar event from outlook
const formatEventToOutlook = (event, tZ, projectCategories = []) => {
  try {
    const isAllDay = Boolean(event.isAllDay);

    const timeZone = tZ
      ? (tZ === "Customized Time Zone" ? 'W. Europe Standard Time' : tZ)
      : defaultTimeZone;

    const dateTimeFormat = isAllDay ? allDayDateFormat : dateFormat
    const startDateTime = momentTz(event.start).tz(timeZone).format(dateTimeFormat);
    const endDateTime = momentTz(event.end).tz(timeZone).format(dateTimeFormat)
    // loggerInfo('formatEventToOutlook', { eventRecurrence: event.recurrence })

    const categories = getCategoryNameArray(projectCategories, event)
    const isSeriesMasterEvent = event.type === OutlookEventTypes.SERIES_MASTER
    return {
      ...event.outlookId && { id: event.outlookId, },
      subject: event.title,
      body: {
        contentType: 'HTML',
        content: event.notes || ''
      },
      start: {
        dateTime: startDateTime,
        timeZone: timeZone,
      },
      end: {
        dateTime: endDateTime,
        timeZone: timeZone,
      },
      originalStartTimeZone: timeZone,
      originalEndTimeZone: timeZone,
      isAllDay,
      ...event.location && {
        location: {
          displayName: event.location
        },
      },
      categories,
      // ...!!categoryName && { categories: [categoryName] },
      // categories: categoryName ? [categoryName] : [],
      type: event.type,
      ...event.recurrence && isSeriesMasterEvent && {
        recurrence: {
          pattern: event.recurrence.pattern,
          range: event.recurrence.range
        },
      },
      sensitivity: event.sensitivity,
      showAs: event.showAs,
    }
  }
  catch (e) {
    loggerError('err', { e })
    return null
  }
}

const formatUpdateEventToOutlook = (event, tZ = defaultTimeZone, projectCategories = []) => {
  try {
    const isAllDay = Boolean(event.isAllDay);

    const dateTimeFormat = isAllDay ? allDayDateFormat : dateFormat

    const timeZone = tZ === "Customized Time Zone" ? 'W. Europe Standard Time' : tZ

    let startDateTime = momentTz(event.start).tz(timeZone).format(dateTimeFormat);
    let endDateTime = momentTz(event.end).tz(timeZone).format(dateTimeFormat);

    const categories = getCategoryNameArray(projectCategories, event)
    const isSeriesMasterEvent = event.type === OutlookEventTypes.SERIES_MASTER

    console.log({
      'event.start': event.start,
      'event.end': event.end,
      startDateTime,
      endDateTime,
    })

    return {
      subject: event.title,
      ...event.notes && {
        body: {
          contentType: 'HTML',
          content: event.notes
        },
      },
      start: {
        dateTime: startDateTime,
        timeZone: timeZone,
      },
      end: {
        dateTime: endDateTime,
        timeZone: timeZone,
      },
      originalStartTimeZone: timeZone,
      originalEndTimeZone: timeZone,
      isAllDay,
      ...event.location && {
        location: {
          displayName: event.location
        },
      },
      categories,
      // ...!!categoryName && { categories: [categoryName] },
      // categories: categoryName ? [categoryName] : [],
      type: event.type,
      sensitivity: event.sensitivity,
      showAs: event.showAs,
      ...event.recurrence && isSeriesMasterEvent && {
        recurrence: {
          pattern: {
            type: event.recurrence.pattern.type,
            interval: event.recurrence.pattern.interval,
            month: event.recurrence.pattern.month,
            dayOfMonth: event.recurrence.pattern.dayOfMonth,
            firstDayOfWeek: event.recurrence.pattern.firstDayOfWeek,
            index: event.recurrence.pattern.index,
            daysOfWeek: event.recurrence.pattern.daysOfWeek
          },
          range: {
            type: event.recurrence.range.type,
            recurrenceTimeZone: timeZone,
            numberOfOccurrences: event.recurrence.range.numberOfOccurrences,
            startDate: event.recurrence.range.startDate,
            endDate: event.recurrence.range.endDate,
          }
        }
      }
    }
  } catch (e) {
    loggerError('Error: ', { e })
    return null
  }
}

const formatEventsToOutlook = (events = [], timeZone, projectCategories) =>
  events.map(event => formatEventToOutlook(event, timeZone, projectCategories))
    .filter(event => Boolean(event));

const getEventsOutlookIds = (events) => events.map(event => event.outlookId)
const getIssueEventsOutlookIds = (events) => events
  .filter(event => !!event.issueCustomFields.outlookId)
  .map(event => event.issueCustomFields.outlookId)

const getOutlookEvent = (outlookEvents, outlookId) => outlookEvents.find(event => event.outlookId === outlookId)



// format issuecustomfieldsevents from the DB to match the structure
// of a calendar event from outlook
const formatIssueEventToOutlook = (event, tZ = defaultTimeZone, { customFields = [], projectCategories = [] }) => {
  try {
    const isAllDay = Boolean(event.issueCustomFields.isAllDay);

    const dateTimeFormat = isAllDay ? allDayDateFormat : dateFormat
    loggerInfo({ dateTimeFormat, field: event.issueCustomFields })

    let start = moment(event.issueCustomFields.value)
    if (start.toString() === "Invalid date") {
      start = moment(event.issueCustomFields.value, 'DD.MM.YYYY HH:mm:ss')
    }
    let end = moment(start).add(event.issueCustomFields.duration || 30, 'minute')
    if (isAllDay) {
      start = moment(start).startOf('day')
      end = moment(start).add(1, 'day').startOf('day')
    }
    const timeZone = tZ === "Customized Time Zone" ? 'W. Europe Standard Time' : tZ

    const startDateTime = momentTz(start).tz(timeZone).format(dateTimeFormat);
    const endDateTime = momentTz(end).tz(timeZone).format(dateTimeFormat)

    loggerInfo({ 'event.issueCustomFields': event.issueCustomFields, start, end, startDateTime, endDateTime })
    const categories = getIssueEventCategoryNameArray({
      customFields,
      // customField: customFields.find(cf => String(cf._id) === String(event.issueCustomFields.fieldId)),
      projectCategories,
      dbEvent: event
    })
    loggerInfo('categoryName-issue-event', { categories })
    return {
      subject: event.titleWithPrefix,
      body: {
        contentType: 'HTML',
        content: ''
      },
      start: {
        dateTime: startDateTime,
        timeZone: timeZone,
      },
      end: {
        dateTime: endDateTime,
        timeZone: timeZone,
      },
      originalStartTimeZone: timeZone,
      originalEndTimeZone: timeZone,
      isAllDay,
      location: {
        displayName: event.location
      },
      categories,
      // ...!!categoryName && { categories: [categoryName] },
      // categories: categoryName ? [categoryName] : [],
    }
  } catch (e) {
    return null
  }
}

const formatIssueEventsToOutlook = (events, timeZone, { customFields, projectCategories }) =>
  events.map(e => formatIssueEventToOutlook(e, timeZone, { customFields, projectCategories }))
    .filter(e => Boolean(e));

const getAggregateOpsEventDuration = ({ projectCheckBoxFieldsIds, projectDateCustomFields }) => [
  {
    $set: {
      checkboxes: {
        $filter: {
          input: "$issueCustomFields",
          as: "checkboxes",
          cond: {
            $and: [
              { $in: ["$$checkboxes.fieldId", projectCheckBoxFieldsIds] },
              { $eq: ["$$checkboxes.value", '1'] },
            ]
          }
        }
      },
    }
  },
  {
    $set: {
      checkboxes: { $map: { input: "$checkboxes", as: "checkbox", in: { $toObjectId: "$$checkbox.fieldId" } } }
    }
  },
  {
    $set: {
      "eventDurations": {
        "$map": {
          "input": "$issueCustomFields",
          "as": "event",
          "in": {
            fieldId: "$$event.fieldId",
            duration: {
              "$sum": {
                "$map": {
                  "input": projectDateCustomFields,
                  "as": "customField",
                  "in": {
                    "$cond": {
                      "if": {
                        "$eq": [
                          { "$toString": "$$customField._id" },
                          { "$toString": "$$event.fieldId" },
                        ]
                      },
                      "then": {
                        $sum: {
                          "$concatArrays": [
                            ["$$customField.duration"],
                            {
                              "$map": {
                                "input": "$$customField.additionalDurations",
                                "as": "addDur",
                                "in": {
                                  "$cond": {
                                    "if": {
                                      "$in": [
                                        "$$addDur.fieldId",
                                        "$checkboxes"
                                      ]
                                    },
                                    "then": "$$addDur.duration",
                                    "else": 0
                                  }
                                }
                              }
                            }
                          ]
                        }
                      },
                      "else": 0
                    },
                  },
                },
              },
            },
          },
        },
      },
    }
  },
  {
    $set: {
      "issueCustomFields": {
        "$map": {
          "input": "$issueCustomFields",
          "as": "event",
          "in": {
            "$mergeObjects": [
              "$$event",
              {
                duration: {
                  $sum: {
                    "$map": {
                      "input": "$eventDurations",
                      "as": "duration",
                      "in": {
                        "$cond": {
                          "if": {
                            $eq: [
                              { $toString: "$$duration.fieldId", },
                              { $toString: "$$event.fieldId" }
                            ]
                          },
                          "then": "$$duration.duration",
                          "else": 0
                        }
                      }
                    }
                  }
                }
              }
            ]
          }
        }
      }
    }
  },
]

const getAggregateOpsEventPrefixTitle = ({ projectPrefixes, prefixesFieldIds }) => [
  {
    $set: {
      projectPrefixes: {
        $map: {
          input: projectPrefixes,
          as: "prefix",
          in: {
            title: "$$prefix.title",
            position: "$$prefix.position",
            fieldId: { $toObjectId: "$$prefix.fieldId" },

          }
        }
      },
      prefixes: {
        $filter: {
          input: "$issueCustomFields",
          as: "issueCustomField",
          cond: {
            $or: [
              { $in: ["$$issueCustomField.fieldId", prefixesFieldIds] },
              { $in: ["$$issueCustomField.fieldId", prefixesFieldIds.map(id => String(id))] },
            ]
          }
        }
      }
    },
  },
  {
    $set: {
      prIds: {
        $map: {
          input: "$prefixes",
          as: "p",
          in: "$$p.fieldId"
        }
      },
      prVals: {
        $map: {
          input: "$prefixes",
          as: "p",
          in: "$$p.value"
        }
      }
    }
  },
  {
    $set: {
      prefixTitles: {
        $map: {
          input: "$projectPrefixes",
          as: "p",
          in: {
            $cond: {
              "if": "$$p.fieldId",
              "then": {
                $cond: {
                  "if": {
                    $gte: [
                      {
                        $indexOfArray: [
                          "$prIds",
                          "$$p.fieldId"
                        ],
                      },
                      0
                    ]
                  },
                  "then": {
                    "$arrayElemAt": [
                      "$prVals",
                      {
                        $indexOfArray: [
                          "$prIds",
                          "$$p.fieldId"
                        ]
                      }
                    ]
                  },
                  "else": ""
                }
              },
              "else": "$$p.title"
            }
          }
        }
      },
    }
  },
  {
    $set: {
      prefixTitle: {
        "$reduce": {
          "input": "$prefixTitles",
          "initialValue": "",
          "in": {
            "$concat": [
              "$$value",
              "$$this",
              "-"
            ]
          }
        }
      }
    }
  },
  {
    $set: {
      prefixTitle: {
        "$cond": {
          "if": {
            $eq: [
              {
                "$ifNull": [
                  "$title",
                  ""
                ]
              },
              ""
            ]
          },
          "then": {
            $substr: [
              "$prefixTitle",
              0,
              {
                "$subtract": [
                  {
                    "$strLenCP": "$prefixTitle"
                  },
                  1
                ]
              }
            ],

          },
          "else": "$prefixTitle"
        }
      }
    }
  },
  {
    $set: {
      titleWithPrefix: {
        $concat: [
          "$prefixTitle",
          {
            "$cond": {
              "if": {
                $eq: [
                  {
                    "$ifNull": [
                      "$title",
                      ""
                    ]
                  },
                  ""
                ]
              },
              "then": "",
              "else": {
                "$ifNull": [
                  "$title",
                  ""
                ]
              },
            }
          },
        ]
      }
    }
  },
]

const getOutlookEventsIdsToDeleteInOutlookFromAktenplatz = async (models, projectId) => {
  const dateCustomFieldsFound = await models.CustomField.find({
    projectId,
    type: 'date'
  });

  const dateCustomFieldsIds = await dateCustomFieldsFound.map(cf => mongoose.Types.ObjectId(cf._id))

  const eventsToDelete = await models.Event.find({
    projectId,
    $or: [{ fromOutlook: false }, { fromOutlook: null }],
    outlookId: { $not: { $eq: null } },
    type: { $nin: [OutlookEventTypes.OCCURRENCE] }
  })

  const issueEventsToDelete = await models.Issue.aggregate([
    {
      $match: {
        projectId: mongoose.Types.ObjectId(projectId),
        'issueCustomFields.fieldId': { $in: dateCustomFieldsIds },
      },
    },
    {
      $set: {
        issueCustomFields: {
          $filter: {
            input: "$issueCustomFields",
            as: "field",
            cond: {
              $in: ["$$field.fieldId", dateCustomFieldsIds],
            }
          },
        },
      },
    },
    {
      $unwind: '$issueCustomFields'
    },
    {
      $match: {
        "issueCustomFields.outlookId": { $ne: null }
      }
    },
  ])


  const outlookEventsIds = [
    ...eventsToDelete.map(e => e.outlookId),
    ...issueEventsToDelete.map(e => e.issueCustomFields.outlookId)
  ]
  loggerInfo('eventstodelete', {
    outlookEventsIds
  })

  return outlookEventsIds
}

const formatEventCategoryFromOutlook = (category) => {
  // "id": "626e696c-6a10-48b8-89b9-12de3160cfb9",
  //   "displayName": "Blue category",
  //     "color": "preset7"

  // return {
  //   title: category.displayName,
  //   color: OutlookCategoryColors[category.color],
  //   outlookColor: category.color,
  //   outlookCategoryId: category.id,
  // }

  return category
}

const formatEventCategoriesFromOutlook = (categories) =>
  categories.map(category => formatEventCategoryFromOutlook(category))

module.exports = {
  formatEventsFromOutlook,
  formatEventFromOutlook,
  formatEventToOutlook,
  formatEventsToOutlook,
  formatUpdateEventToOutlook,
  getOutlookEvent,
  getEventsOutlookIds,
  formatIssueEventsToOutlook,
  formatIssueEventToOutlook,
  getIssueEventsOutlookIds,
  getAggregateOpsEventPrefixTitle,
  getOutlookEventsIdsToDeleteInOutlookFromAktenplatz,
  formatEventCategoryFromOutlook,
  formatEventCategoriesFromOutlook,
  getAggregateOpsEventDuration
}
