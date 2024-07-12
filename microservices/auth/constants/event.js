const moment = require('moment');

const DaysOfWeekArray = moment.weekdays().map(d => d.toLowerCase())

const OutlookEventTypes = {
  SINGLE_INSTANCE: 'singleInstance',
  OCCURRENCE: 'occurrence',
  EXCEPTION: 'exception',
  SERIES_MASTER: 'seriesMaster',
}

const OutlookEventTypesArray = [
  OutlookEventTypes.SINGLE_INSTANCE,
  OutlookEventTypes.OCCURRENCE,
  OutlookEventTypes.EXCEPTION,
  OutlookEventTypes.SERIES_MASTER,
]

const RecurrenceTypes = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  ABSOLUTE_MONTHLY: 'absoluteMonthly',
  RELATIVE_MONTHLY: 'relativeMonthly',
  ABSOLUTE_YEARLY: 'absoluteYearly',
  RELATIVE_YEARLY: 'relativeYearly',
}

const RecurrenceTypesArray = [
  RecurrenceTypes.DAILY,
  RecurrenceTypes.WEEKLY,
  RecurrenceTypes.ABSOLUTE_MONTHLY,
  RecurrenceTypes.RELATIVE_MONTHLY,
  RecurrenceTypes.ABSOLUTE_YEARLY,
  RecurrenceTypes.RELATIVE_YEARLY,
]

const RecurrenceIndex = {
  FIRST: 'first',
  SECOND: 'second',
  THIRD: 'third',
  FOURTH: 'fourth',
  LAST: 'last',
}

const RecurrenceIndexArray = [
  RecurrenceIndex.FIRST,
  RecurrenceIndex.SECOND,
  RecurrenceIndex.THIRD,
  RecurrenceIndex.FOURTH,
  RecurrenceIndex.LAST,
]

const RecurrenceRangeType = {
  END_DATE: 'endDate',
  NO_END: 'noEnd',
  NUMBERED: 'numbered',
}

const RecurrenceRangeTypeArray = [
  RecurrenceRangeType.END_DATE,
  RecurrenceRangeType.NO_END,
  RecurrenceRangeType.NUMBERED,
]

const EventPatternTypes = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'absoluteMonthly',
  YEARLY: 'absoluteYearly',
}

const EventPatternTypesArray = [
  EventPatternTypes.DAILY,
  EventPatternTypes.WEEKLY,
  EventPatternTypes.MONTHLY,
  EventPatternTypes.YEARLY,
]

const ShowAsTypes = {
  FREE: 'free',
  // TENTATIVE: 'tentative',
  BUSY: 'busy',
  // OOF: 'oof',
  // WORKING_ELSEWHERE: 'workingElsewhere',
  // UNKNOWN: 'unknown'
}

const ShowAsTypesArray = [
  ShowAsTypes.FREE,
  // ShowAsTypes.TENTATIVE,
  ShowAsTypes.BUSY,
  // ShowAsTypes.OOF,
  // ShowAsTypes.WORKING_ELSEWHERE,
  // ShowAsTypes.UNKNOWN,
]

const SensitivityTypes = {
  NORMAL: 'normal',
  // PERSONAL: 'personal',
  PRIVATE: 'private',
  // CONFIDENTIAL: 'confidential',
}

const SensitivityTypesArray = [
  SensitivityTypes.NORMAL,
  // SensitivityTypes.PERSONAL,
  SensitivityTypes.PRIVATE,
  // SensitivityTypes.CONFIDENTIAL,
]

const OutlookCategoryPresetColorTypes = {
  PRESET_0: 'preset0',
  PRESET_1: 'preset1',
  PRESET_2: 'preset2',
  PRESET_3: 'preset3',
  PRESET_4: 'preset4',
  PRESET_5: 'preset5',
  PRESET_6: 'preset6',
  PRESET_7: 'preset7',
  PRESET_8: 'preset8',
  PRESET_9: 'preset9',
  PRESET_10: 'preset10',
  PRESET_11: 'preset11',
  PRESET_12: 'preset12',
  PRESET_13: 'preset13',
  PRESET_14: 'preset14',
  PRESET_15: 'preset15',
  PRESET_16: 'preset16',
  PRESET_17: 'preset17',
  PRESET_18: 'preset18',
  PRESET_19: 'preset19',
  PRESET_20: 'preset20',
  PRESET_21: 'preset21',
  PRESET_22: 'preset22',
  PRESET_23: 'preset23',
  PRESET_24: 'preset24',
}

const OutlookCategoryColors = {
  [OutlookCategoryPresetColorTypes.PRESET_0]: '#E74856',
  [OutlookCategoryPresetColorTypes.PRESET_1]: '#FF8C00',
  [OutlookCategoryPresetColorTypes.PRESET_2]: '#FFAB45',
  [OutlookCategoryPresetColorTypes.PRESET_3]: '#FFF100',
  [OutlookCategoryPresetColorTypes.PRESET_4]: '#47D041',
  [OutlookCategoryPresetColorTypes.PRESET_5]: '#30C6CC',
  [OutlookCategoryPresetColorTypes.PRESET_6]: '#73AA24',
  [OutlookCategoryPresetColorTypes.PRESET_7]: '#00BCF2',
  [OutlookCategoryPresetColorTypes.PRESET_8]: '#8764B8',
  [OutlookCategoryPresetColorTypes.PRESET_9]: '#F495BF',
  [OutlookCategoryPresetColorTypes.PRESET_10]: '#A0AEB2',
  [OutlookCategoryPresetColorTypes.PRESET_11]: '#004B60',
  [OutlookCategoryPresetColorTypes.PRESET_12]: '#B1ADAB',
  [OutlookCategoryPresetColorTypes.PRESET_13]: '#5D5A58',
  [OutlookCategoryPresetColorTypes.PRESET_14]: '#000000',
  [OutlookCategoryPresetColorTypes.PRESET_15]: '#750B1C',
  [OutlookCategoryPresetColorTypes.PRESET_16]: '#CA5010',
  [OutlookCategoryPresetColorTypes.PRESET_17]: '#AB620D',
  [OutlookCategoryPresetColorTypes.PRESET_18]: '#C19C00',
  [OutlookCategoryPresetColorTypes.PRESET_19]: '#004B1C',
  [OutlookCategoryPresetColorTypes.PRESET_20]: '#004B50',
  [OutlookCategoryPresetColorTypes.PRESET_21]: '#0B6A0B',
  [OutlookCategoryPresetColorTypes.PRESET_22]: '#002050',
  [OutlookCategoryPresetColorTypes.PRESET_23]: '#32145A',
  [OutlookCategoryPresetColorTypes.PRESET_24]: '#5C005C',
}

const OutlookCategoryPresetColorsArray = [
  OutlookCategoryPresetColorTypes.PRESET_0,
  OutlookCategoryPresetColorTypes.PRESET_1,
  OutlookCategoryPresetColorTypes.PRESET_2,
  OutlookCategoryPresetColorTypes.PRESET_3,
  OutlookCategoryPresetColorTypes.PRESET_4,
  OutlookCategoryPresetColorTypes.PRESET_5,
  OutlookCategoryPresetColorTypes.PRESET_6,
  OutlookCategoryPresetColorTypes.PRESET_7,
  OutlookCategoryPresetColorTypes.PRESET_8,
  OutlookCategoryPresetColorTypes.PRESET_9,
  OutlookCategoryPresetColorTypes.PRESET_10,
  OutlookCategoryPresetColorTypes.PRESET_11,
  OutlookCategoryPresetColorTypes.PRESET_12,
  OutlookCategoryPresetColorTypes.PRESET_13,
  OutlookCategoryPresetColorTypes.PRESET_14,
  OutlookCategoryPresetColorTypes.PRESET_15,
  OutlookCategoryPresetColorTypes.PRESET_16,
  OutlookCategoryPresetColorTypes.PRESET_17,
  OutlookCategoryPresetColorTypes.PRESET_18,
  OutlookCategoryPresetColorTypes.PRESET_19,
  OutlookCategoryPresetColorTypes.PRESET_20,
  OutlookCategoryPresetColorTypes.PRESET_21,
  OutlookCategoryPresetColorTypes.PRESET_22,
  OutlookCategoryPresetColorTypes.PRESET_23,
  OutlookCategoryPresetColorTypes.PRESET_24,
]

const CategoryOrigin = {
  OUTLOOK: 'outlook',
  CUSTOM_FIELDS: 'custom_fields',
  EVENT_CATEGORIES: 'event_categories',
}

module.exports = {
  OutlookEventTypes,
  OutlookEventTypesArray,
  RecurrenceTypes,
  RecurrenceTypesArray,
  DaysOfWeekArray,
  RecurrenceIndex,
  RecurrenceIndexArray,
  RecurrenceRangeType,
  RecurrenceRangeTypeArray,
  EventPatternTypes,
  EventPatternTypesArray,
  ShowAsTypes,
  ShowAsTypesArray,
  SensitivityTypes,
  SensitivityTypesArray,
  CategoryOrigin,
  OutlookCategoryPresetColorTypes,
  OutlookCategoryColors,
  OutlookCategoryPresetColorsArray,
}
