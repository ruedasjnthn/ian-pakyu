const parseString = require("xml2js").parseString;
const { promisify } = require("util");
const { loggerInfo, loggerError } = require('../config/logger')

const promisfiedParseString = promisify(parseString);

module.exports = class Parser {

  static async convertXMLToJSON(xmlMessage) {
    loggerInfo("convertXMLToJSON");
    loggerInfo(xmlMessage);
    const options = { trim: true, explicitArray: false, explicitRoot: true };
    return promisfiedParseString(xmlMessage, options);
  }

  static jsonPathToValue(jsonData, path) {
    if (!(jsonData instanceof Object) || typeof (path) === "undefined") {
      throw "Not valid argument:jsonData:" + jsonData + ", path:" + path;
    }
    path = path.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    path = path.replace(/^\./, ''); // strip a leading dot
    var pathArray = path.split('.');
    for (var i = 0, n = pathArray.length; i < n; ++i) {
      var key = pathArray[i];
      if (key in jsonData) {
        if (jsonData[key] !== null) {
          jsonData = jsonData[key];
        } else {
          return null;
        }
      } else {
        return key;
      }
    }
    return jsonData;
  }

  static decodeEntities(encodedString) {
    var translate_re = /&(nbsp|amp|quot|lt|gt);/g;
    var translate = {
        "nbsp":" ",
        "amp" : "&",
        "quot": "\"",
        "lt"  : "<",
        "gt"  : ">"
    };
    return encodedString.replace(translate_re, function(match, entity) {
        return translate[entity];
    }).replace(/&#(\d+);/gi, function(match, numStr) {
        var num = parseInt(numStr, 10);
        return String.fromCharCode(num);
    });
}
};
