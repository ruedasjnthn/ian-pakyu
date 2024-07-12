const moment = require('moment')
const momentTz = require("moment-timezone");
const { OutlookEventTypes, CalendarSyncRange } = require('../constants/outlook');
const { loggerInfo, loggerError } = require('../config/logger');
const { parseMomentDate } = require('./DateTimeHelpers');
const { defaultTimeZone, dateFormat } = require('../constants/calendar');


const isEventDateSame = (date1, date2) => {
  try {
    return moment(moment(date1).tz('UTC').format(dateFormat)).isSame(date2)
  } catch (e) {
    loggerError('is evenmsame err', { e })
    return false
  }
}

const isEventModified = (dbEvent, outlookEvent) => {
  const type = outlookEvent.type;
  const valDiff = {
    title: outlookEvent.title !== dbEvent.title,
    start: type === OutlookEventTypes.SERIES_MASTER ? false : !isEventDateSame(dbEvent.start, outlookEvent.start),
    end: type === OutlookEventTypes.SERIES_MASTER ? false : !isEventDateSame(dbEvent.end, outlookEvent.end),
    isAllDay: outlookEvent.isAllDay !== dbEvent.isAllDay,
    location: outlookEvent.location !== dbEvent.location,
    notes: outlookEvent.notes !== dbEvent.notes,
    categoryId: String(outlookEvent.categoryId) !== String(dbEvent.categoryId),
    type: outlookEvent.type !== dbEvent.type,
  }

  let isRecurrenceDifferent = false

  if (outlookEvent.recurrence && dbEvent.recurrence) {
    isRecurrenceDifferent =
      JSON.stringify(outlookEvent.recurrence.pattern) !== JSON.stringify(dbEvent.recurrence.pattern)
      || outlookEvent.recurrence.range.type !== dbEvent.recurrence.range.type
      || outlookEvent.recurrence.range.startDate !== dbEvent.recurrence.range.startDate
      || outlookEvent.recurrence.range.endDate !== dbEvent.recurrence.range.endDate
      || outlookEvent.recurrence.range.numberOfOccurrences !== dbEvent.recurrence.range.numberOfOccurrences
    loggerInfo({
      valDiff,
      isRecurrenceDifferent,
      'outlookEvent.recurrence.pattern': outlookEvent.recurrence.pattern,
      'dbEvent.recurrence.pattern': dbEvent.recurrence.pattern,
      'outlookEvent.recurrence.range': outlookEvent.recurrence.range,
      'dbEvent.recurrence.range': dbEvent.recurrence.range,
    })
  }

  const isModified =
    valDiff.title ||
    valDiff.isAllDay ||
    valDiff.location ||
    valDiff.notes ||
    valDiff.start ||
    valDiff.end ||
    valDiff.categoryId ||
    valDiff.type ||
    valDiff.isAllDay ||
    valDiff.type ||
    isRecurrenceDifferent

  return isModified
}

const getIsIssueEventModified = (
  issueEvent,
  outlookEvent,
  options = {
    timeZone: defaultTimeZone,
    customFields: [],
    projectCategories: []
  }
) => {
  const issueCustomField = issueEvent.issueCustomFields
  if (!issueCustomField) return false

  const title = issueEvent.titleWithPrefix || issueEvent.title
  const issueCustomFieldValue = issueCustomField.value
  const duration = issueCustomField.duration || 30
  const isAllDay = Boolean(issueCustomField.isAllDay)

  const start = parseMomentDate(issueCustomFieldValue).toISOString()
  const end = parseMomentDate(issueCustomFieldValue).add(duration || 30, 'minute').toISOString()

  const isStartSame = moment(start).isSame(outlookEvent.start)
  const isEndSame = moment(end).isSame(outlookEvent.end)

  const valDiff = {
    title: title !== outlookEvent.title,
    start: !isStartSame,
    end: !isEndSame,
    isAllDay: isAllDay !== outlookEvent.isAllDay,
    // categoryId: String(outlookEvent.categoryId) !== String(dbEvent.categoryId),
    type: outlookEvent.type !== OutlookEventTypes.SINGLE_INSTANCE,
  }

  const isModified =
    valDiff.title ||
    valDiff.start ||
    valDiff.end ||
    valDiff.isAllDay ||
    valDiff.type

  loggerInfo('getIsIssueEventModified', {
    isModified,
    start,
    end,
    title,
    issueCustomFieldValue,
    duration,
    outlookEvent,
    outlookEventStart: outlookEvent.start,
    outlookEventEnd: outlookEvent.end,
    valDiff,
  })



  return isModified
}

const getLatestUpdatedEvent = (dbEvent, outlookEvent) => {
  const eventModifiedAt = dbEvent.deletedAt || dbEvent.updatedAt || dbEvent.createdAt;
  const outlookEventUpdateAt = outlookEvent.lastModifiedDateTime;

  // test if what event has the most recent change 
  const isOutlookEventModifiedLater = moment(outlookEventUpdateAt).isAfter(eventModifiedAt)
  // const difference = moment(eventModifiedAt).diff(outlookEventUpdateAt, 'millisecond')
  const latestUpdatedEvent = isOutlookEventModifiedLater ? 'outlookEvent' : 'event'

  loggerInfo({
    isDbEventModifiedLater: isOutlookEventModifiedLater,
    eventModifiedAt,
    outlookEventUpdateAt,
  })

  return latestUpdatedEvent
}

// const getEventCategory = (projectCategories, dbEvent }) => {
//   const category = projectCategories && projectCategories
//     .find(pec => String(pec._id) === String(dbEvent.categoryId))
//   const categoryName = category && (category.title || category.displayName)

//   return categoryName
// }

const getCategoryNameArray = (projectCategories = [], dbEvent) => {
  const categoryId = dbEvent.categoryId
  if (!categoryId) return []

  let category = projectCategories.find(pec =>
    String(pec._id || pec.id) === String(categoryId))

  if (!category)
    category = projectCategories.find(pec =>
      String(pec.projectEventCategoryId) === String(categoryId))

  loggerInfo('getCategoryNameArray', {
    category,
    categoryId
  })

  if (category) {
    const categoryName = (category.title || category.displayName)
    loggerInfo('getCategoryNameArray', { categoryName })
    if (categoryName) return [categoryName]
    else return undefined
  } else return undefined

}

const getIssueEventCategoryNameArray = ({ customFields = [], projectCategories = [], dbEvent }) => {
  if (!dbEvent.issueCustomFields) return undefined;

  const customField = customFields.find(cf => String(cf._id) === String(dbEvent.issueCustomFields.fieldId))
  if (!customField) return undefined
  if (!customField.categoryId) return undefined

  let category = projectCategories.find(coc =>
    String(coc._id || coc.id) === String(customField.categoryId))

  if (!category)
    category = projectCategories.find(pec =>
      String(pec.projectEventCategoryId) === String(customField.categoryId))

  loggerInfo('getIssueEventCategoryNameArray', {
    category,
    'dbEvent.issueCustomFields.fieldId': dbEvent.issueCustomFields.fieldId
  })

  if (category) {
    const categoryName = category.displayName
    loggerInfo('getCategoryNameArray', { categoryName })
    if (categoryName) return [categoryName]
    else return undefined
  } else return undefined

}

const getCategoryId = (projectCategories = [], outlookCategoryName) => {
  // const categories = olEvent.categories || []
  // const outlookCategoryName = categories[0]

  const category = outlookCategoryName
    ? projectCategories.find(coc => {
      const olCategoryName = coc.title || coc.displayName
      const olCategory = String(olCategoryName).toLowerCase()
      const evCategory = String(outlookCategoryName).toLowerCase()
      loggerInfo('getCategoryId_debug', {
        olCategoryName,
        olCategory,
        evCategory,
      })
      return olCategory === evCategory
    })
    : null

  const categoryId = category && (category._id || category.id)

  loggerInfo('getCategoryId_debug', {
    outlookCategoryName,
    categoryId,
    category,
    outlookCategoryName,
  })

  return categoryId
}

const isContactModified = (dbContact, outlookContact) => {
  const valDiff = {
    name: outlookContact.name !== dbContact.name,
    contact_information: dbContact.contact_information !== outlookContact.contact_information,
    home_address: outlookContact.home_address !== dbContact.home_address,
    business_address: outlookContact.business_address !== dbContact.business_address,
    other_address: dbContact.other_address !== outlookContact.other_address,
    work: outlookContact.work !== dbContact.work,
    other: outlookContact.other !== dbContact.other,
    notes: outlookContact.notes !== dbContact.notes,
  }

  const isModified =
    valDiff.name ||
    valDiff.contact_information ||
    valDiff.home_address ||
    valDiff.business_address ||
    valDiff.other_address ||
    valDiff.work ||
    valDiff.other ||
    valDiff.notes

  return isModified
}

const getLatestUpdatedContact = (dbContact, outlookContact) => {
  const eventUpdatedAt = dbContact.updatedAt;
  const outlookContactUpdateAt = outlookContact.lastModifiedDateTime;

  // test if what event has the most recent update 
  const difference = moment(eventUpdatedAt).diff(outlookContactUpdateAt, 'seconds')
  const latestUpdatedContact = difference > 0 && Boolean(eventUpdatedAt) ? 'contact' : 'outlookContact'
  loggerInfo({
    difference,
    latestUpdatedContact,
    eventUpdatedAt,
    outlookContactUpdateAt,
    cond: difference > 0 && Boolean(eventUpdatedAt)
  })

  return latestUpdatedContact
}


const isEventOutOfRange = ({
  eventStartDate,
  timeZone
}) => {
  // const startDateTime = momentTz().subtract(1, 'year').startOf('year').tz(timeZone);
  // const endDateTime = momentTz().add(2, 'year').endOf('year').tz(timeZone);
  const startDateTime = CalendarSyncRange.getStart()
  const endDateTime = CalendarSyncRange.getEnd()

  loggerInfo({
    startDateTime,
    eventStartDate,
  })

  const isOutsideRange = momentTz(eventStartDate).tz(timeZone).isBefore(startDateTime)
    || momentTz(eventStartDate).tz(timeZone).isAfter(endDateTime)

  loggerInfo({ isOutsideRange })

  return isOutsideRange
}

const getRandomOutlookCategoryPresetColor = () =>
  `preset${Math.floor(Math.random() * (24 + 1))}`;

const isDisplayNameSame = (dName1, dName2) =>
  String(dName1).toLowerCase() === String(dName2).toLowerCase()

module.exports = {
  isEventModified,
  getIsIssueEventModified,
  getLatestUpdatedEvent,
  getCategoryNameArray,
  getCategoryId,
  isContactModified,
  getLatestUpdatedContact,
  isEventOutOfRange,
  getRandomOutlookCategoryPresetColor,
  isDisplayNameSame,
  getIssueEventCategoryNameArray
}
