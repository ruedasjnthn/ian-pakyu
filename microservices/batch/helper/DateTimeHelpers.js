const moment = require("moment");

const getIsDateTimeWithZ = (dateString) => dateString.includes("Z");

const parseMomentDate = (date, format) => {
  const isDateTimeWithZ = getIsDateTimeWithZ(date)

  if (isDateTimeWithZ)
    return moment(date, format || 'YYYY-MM-DD-THH:mm:ssZ')
  else
    return moment(date)
}

module.exports = {
  parseMomentDate
}