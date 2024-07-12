require("dotenv").config();
const moment = require('moment');

const isDevIj = process.env.IJ_DEV === 'true';
const isDevBenj = process.env.BENJ_DEV === 'true';

const IJ_DEV_OutlookSyncStatusTypes = {
  READY_TO_INITIALIZE: 'ij_dev_ready_to_initialize',
  INITIALIZING: 'ij_dev_initializing',
  FAILED_INITIALIZING: 'ij_dev_failed_initializing',
  PENDING: 'ij_dev_pending',
  READY_TO_SYNC: 'ij_dev_ready_to_sync',
  FAILED_SYNCING: 'ij_dev_failed_syncing',
  SYNCING: 'ij_dev_syncing',
  SUCCESS: 'ij_dev_success',
  DISABLING: 'ij_dev_disabling',
  AUTHORIZING: 'ij_dev_authorizing',
  FAILED_FIRST_SYNCING: 'ij_dev_failed_first_syncing',
  FAILED_FIRST_INITIALIZING: 'ij_dev_failed_first_initializing',
}

const LOCAL_DEV_OutlookSyncStatusTypes = {
  READY_TO_INITIALIZE: 'dev_ready_to_initialize',
  INITIALIZING: 'dev_initializing',
  FAILED_INITIALIZING: 'dev_failed_initializing',
  PENDING: 'dev_pending',
  READY_TO_SYNC: 'dev_ready_to_sync',
  FAILED_SYNCING: 'dev_failed_syncing',
  SYNCING: 'dev_syncing',
  SUCCESS: 'dev_success',
  DISABLING: 'dev_disabling',
  AUTHORIZING: 'dev_authorizing',
  FAILED_FIRST_SYNCING: 'dev_failed_first_syncing',
  FAILED_FIRST_INITIALIZING: 'dev_failed_first_initializing',
}

const PROD_OutlookSyncStatusTypes = {
  READY_TO_INITIALIZE: 'ready_to_initialize',
  INITIALIZING: 'initializing',
  FAILED_INITIALIZING: 'failed_initializing',
  PENDING: 'pending',
  READY_TO_SYNC: 'ready_to_sync',
  FAILED_SYNCING: 'failed_syncing',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  DISABLING: 'disabling',
  AUTHORIZING: 'authorizing',
  FAILED_FIRST_SYNCING: 'failed_first_syncing',
  FAILED_FIRST_INITIALIZING: 'failed_first_initializing',
}

const OutlookSyncStatusTypes = isDevIj
  ? IJ_DEV_OutlookSyncStatusTypes
  : PROD_OutlookSyncStatusTypes

const OutlookSyncStatusTypesArray = [
  OutlookSyncStatusTypes.READY_TO_INITIALIZE,
  OutlookSyncStatusTypes.INITIALIZING,
  OutlookSyncStatusTypes.FAILED_INITIALIZING,
  OutlookSyncStatusTypes.READY_TO_SYNC,
  OutlookSyncStatusTypes.FAILED_SYNCING,
  OutlookSyncStatusTypes.SYNCING,
  OutlookSyncStatusTypes.PENDING,
  OutlookSyncStatusTypes.SUCCESS,
]

const OutlookCategoryPresetColors = {
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
  [OutlookCategoryPresetColors.PRESET_0]: '#E74856',
  [OutlookCategoryPresetColors.PRESET_1]: '#FF8C00',
  [OutlookCategoryPresetColors.PRESET_2]: '#FFAB45',
  [OutlookCategoryPresetColors.PRESET_3]: '#FFF100',
  [OutlookCategoryPresetColors.PRESET_4]: '#47D041',
  [OutlookCategoryPresetColors.PRESET_5]: '#30C6CC',
  [OutlookCategoryPresetColors.PRESET_6]: '#73AA24',
  [OutlookCategoryPresetColors.PRESET_7]: '#00BCF2',
  [OutlookCategoryPresetColors.PRESET_8]: '#8764B8',
  [OutlookCategoryPresetColors.PRESET_9]: '#F495BF',
  [OutlookCategoryPresetColors.PRESET_10]: '#A0AEB2',
  [OutlookCategoryPresetColors.PRESET_11]: '#004B60',
  [OutlookCategoryPresetColors.PRESET_12]: '#B1ADAB',
  [OutlookCategoryPresetColors.PRESET_13]: '#5D5A58',
  [OutlookCategoryPresetColors.PRESET_14]: '#000000',
  [OutlookCategoryPresetColors.PRESET_15]: '#750B1C',
  [OutlookCategoryPresetColors.PRESET_16]: '#CA5010',
  [OutlookCategoryPresetColors.PRESET_17]: '#AB620D',
  [OutlookCategoryPresetColors.PRESET_18]: '#C19C00',
  [OutlookCategoryPresetColors.PRESET_19]: '#004B1C',
  [OutlookCategoryPresetColors.PRESET_20]: '#004B50',
  [OutlookCategoryPresetColors.PRESET_21]: '#0B6A0B',
  [OutlookCategoryPresetColors.PRESET_22]: '#002050',
  [OutlookCategoryPresetColors.PRESET_23]: '#32145A',
  [OutlookCategoryPresetColors.PRESET_24]: '#5C005C',
}

const OutlookCategoryPresetColorsArray = [
  OutlookCategoryPresetColors.PRESET_0,
  OutlookCategoryPresetColors.PRESET_1,
  OutlookCategoryPresetColors.PRESET_2,
  OutlookCategoryPresetColors.PRESET_3,
  OutlookCategoryPresetColors.PRESET_4,
  OutlookCategoryPresetColors.PRESET_5,
  OutlookCategoryPresetColors.PRESET_6,
  OutlookCategoryPresetColors.PRESET_7,
  OutlookCategoryPresetColors.PRESET_8,
  OutlookCategoryPresetColors.PRESET_9,
  OutlookCategoryPresetColors.PRESET_10,
  OutlookCategoryPresetColors.PRESET_11,
  OutlookCategoryPresetColors.PRESET_12,
  OutlookCategoryPresetColors.PRESET_13,
  OutlookCategoryPresetColors.PRESET_14,
  OutlookCategoryPresetColors.PRESET_15,
  OutlookCategoryPresetColors.PRESET_16,
  OutlookCategoryPresetColors.PRESET_17,
  OutlookCategoryPresetColors.PRESET_18,
  OutlookCategoryPresetColors.PRESET_19,
  OutlookCategoryPresetColors.PRESET_20,
  OutlookCategoryPresetColors.PRESET_21,
  OutlookCategoryPresetColors.PRESET_22,
  OutlookCategoryPresetColors.PRESET_23,
  OutlookCategoryPresetColors.PRESET_24,
]

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

const DaysOfWeekArray = moment.weekdays().map(d => d.toLowerCase())

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

const CalendarSyncRange = {
  getStart: () => moment().subtract(3, 'month').startOf('month').toISOString(),
  getEnd: () => moment().add(1, 'year').endOf('month').toISOString(),
}

const startDateTime = CalendarSyncRange.getStart()
const endDateTime = CalendarSyncRange.getEnd()

const CalendarRangeFilter = {
  $or: [
    {
      $and: [
        { start: { $gte: new Date(startDateTime) } },
        { start: { $lte: new Date(endDateTime) } },
      ],
    },
    {
      $and: [
        { end: { $gte: new Date(startDateTime) } },
        { end: { $lte: new Date(endDateTime) } },
      ],
    },
    {
      $and: [
        { start: { $lte: new Date(startDateTime) } },
        { end: { $gte: new Date(endDateTime) } },
      ],
    },
  ]
  // "$or": [
  //   {
  //     "$and": [
  //       { start: { "$gte": startDateTime } },
  //       { start: { "$lt": endDateTime } }
  //     ]
  //   },
  //   {
  //     "$and": [
  //       { start: { "$lt": startDateTime } },
  //       { end: { "$gt": endDateTime } }
  //     ]
  //   },
  //   {
  //     "$and": [
  //       { end: { "$gt": startDateTime } },
  //       { end: { "$lte": endDateTime } }
  //     ]
  //   },
  // ]
}

const EVENT_LATEST_CHANGE = {
  FROM_DB: 'from_db',
  FROM_OUTLOOK: 'from_outlook',
}

module.exports = {
  OutlookSyncStatusTypes,
  OutlookSyncStatusTypesArray,
  OutlookCategoryPresetColors,
  OutlookCategoryColors,
  OutlookCategoryPresetColorsArray,
  OutlookEventTypes,
  OutlookEventTypesArray,
  RecurrenceTypes,
  RecurrenceTypesArray,
  DaysOfWeekArray,
  RecurrenceIndex,
  RecurrenceIndexArray,
  RecurrenceRangeType,
  RecurrenceRangeTypeArray,
  ShowAsTypes,
  ShowAsTypesArray,
  SensitivityTypes,
  SensitivityTypesArray,
  CalendarSyncRange,
  CalendarRangeFilter,
  EVENT_LATEST_CHANGE
}
