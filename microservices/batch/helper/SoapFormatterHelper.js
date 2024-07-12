module.exports = class Formatter {
  static wrapXmlInSoapWrapper(body) {
    return `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://tempuri.org/"><soap:Header/><soap:Body>${body}</soap:Body></soap:Envelope>`;
  }
};