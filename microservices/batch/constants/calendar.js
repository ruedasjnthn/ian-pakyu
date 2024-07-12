const CalendarLogActionTypes = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
}

const CalendarLogActionTypesArray = [
  CalendarLogActionTypes.CREATE,
  CalendarLogActionTypes.UPDATE,
  CalendarLogActionTypes.DELETE,
]

const dateFormat = 'YYYY-MM-DDTHH:mm:ss.ssssss';
const dateComparingFormat = 'YYYY-MM-DDTHH:mm';
const allDayDateFormat = 'YYYY-MM-DD';
const defaultTimeZone = 'Europe/Berlin';

module.exports = {
  CalendarLogActionTypes,
  CalendarLogActionTypesArray,
  dateFormat,
  dateComparingFormat,
  allDayDateFormat,
  defaultTimeZone,
}
