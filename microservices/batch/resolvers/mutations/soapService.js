const mongoose = require('mongoose');
const HttpHelper = require('../../helper/HttpHelper');
const Parser = require('../../helper/ParserHelper');
const SoapFormatterHelper = require('../../helper/SoapFormatterHelper');
const { loggerInfo, loggerError } = require('../../config/logger');

const saveSoapService = async (_, { soapServiceInput }, { models }) => {
  loggerInfo(soapServiceInput);
  try {
    let data = {
      contentType: soapServiceInput.contentType,
      dataNode: soapServiceInput.dataNode,
      haveMultipleRecords: soapServiceInput.haveMultipleRecords,
      inputParams: soapServiceInput.inputParams,
      name: soapServiceInput.name,
      password: soapServiceInput.password,
      soapAction: soapServiceInput.soapAction,
      url: soapServiceInput.url,
      projectId: soapServiceInput.projectId,
      userName: soapServiceInput.userName,
      decodingNode: soapServiceInput.decodingNode,
      xmlMappingKeys: soapServiceInput.xmlMappingKeys,
      isEnabled: soapServiceInput.isEnabled,
      repeatForEveryIssue: soapServiceInput.repeatForEveryIssue,
      serviceType: soapServiceInput.serviceType,
      requestType: soapServiceInput.requestType,
      customHeaders: soapServiceInput.customHeaders,
      incrementPageBy: soapServiceInput.incrementPageBy,
      supportPaging: soapServiceInput.supportPaging,
      requirePreAuthorization: soapServiceInput.requirePreAuthorization,
      authorizatioURL: soapServiceInput.authorizatioURL,
      authorizationRequestType: soapServiceInput.authorizationRequestType,
      authorizationBody: soapServiceInput.authorizationBody,
      authorizationTokenPath: soapServiceInput.authorizationTokenPath,
      upsertIssueStatus: soapServiceInput.upsertIssueStatus
    };

    if (soapServiceInput.fieldMapping) {
      data.fieldMapping = soapServiceInput.fieldMapping;
    }
    if (soapServiceInput.soapServiceId) {
      await models.SoapService.findOneAndUpdate(
        { _id: soapServiceInput.soapServiceId },
        data,
      );
      return soapServiceInput.soapServiceId;
    } else {
      var ts = await models.SoapService.create(data);
      return ts._id;
    }
  } catch (e) {
    loggerError({ e });
  }

  return '';
};

const deleteSoapService = async (_, { soapServiceId }, { models }) => {
  loggerInfo(soapServiceId);
  try {
    await models.SoapService.deleteOne({ _id: soapServiceId });
    return 'deleted';
  } catch (error) {
    loggerError({ error });
  }

  return '';
};

const getSoapServiceMappingFields = async (
  _,
  { soapServiceInput },
  { models },
) => {
  let soapService = soapServiceInput;
  try {
    loggerInfo('soap service object', soapService);
    if (soapService) {
      loggerInfo('calling execute');
      if (soapService.serviceType == 'JSON') {
        let jsonSoapBody = await HttpHelper.Execute(
         await getHttpRequestObject(soapService),
        );

        if (soapService.dataNode)
          jsonSoapBody = Parser.jsonPathToValue(
            jsonSoapBody,
            soapService.dataNode,
          );

        if (soapService.haveMultipleRecords) {
          return Object.keys(jsonSoapBody[0]);
        } else {
          return Object.keys(jsonSoapBody);
        }
      } else {
        const soapResponse = await HttpHelper.Execute(
         await getHttpRequestObject(soapService),
        );
        let jsonResponse = await Parser.convertXMLToJSON(soapResponse);

        let jsonSoapBody = jsonResponse['soap:Envelope']['soap:Body'];

        if (soapService.decodingNode) {
          jsonSoapBody = await Parser.convertXMLToJSON(
            Parser.jsonPathToValue(jsonSoapBody, soapService.decodingNode),
          );
          loggerInfo('after decoding node');
          loggerInfo('jsonSoapBody', JSON.stringify(jsonSoapBody));
        }

        jsonSoapBody = Parser.jsonPathToValue(
          jsonSoapBody,
          soapService.dataNode,
        );
        loggerInfo('dataNode');
        loggerInfo('jsonSoapBody', JSON.stringify(jsonSoapBody));
        if (soapService.haveMultipleRecords) {
          return Object.keys(jsonSoapBody[0]).filter((x) => x != '$');
        } else {
          return Object.keys(jsonSoapBody).filter((x) => x != '$');
        }
      }
    }
  } catch (error) {
    loggerError({ error });
  }
  return [];
};

const getUpsertRequestFromSoapService = async (
  _,
  { soapServiceId, issueId },
  { models },
) => {
  let soapService = await models.SoapService.findById(soapServiceId);

  if (soapService) {
    try {
      if (soapService.url && soapService.contentType) {
        if (soapService.repeatForEveryIssue) {
          let pObjId = mongoose.Types.ObjectId(soapService.projectId);
          let issueObjId = mongoose.Types.ObjectId(issueId);
          var issuesList = await models.Project.aggregate([
            {
              $match: {
                _id: pObjId,
              },
            },
            {
              $lookup: {
                from: 'col_Issues',
                localField: '_id',
                foreignField: 'projectId',
                as: 'issues',
              },
            },
            {
              $project: {
                issues: {
                  $filter: {
                    input: '$issues',
                    as: 'item',
                    cond: {
                      $eq: ['$$item._id', issueObjId],
                    },
                  },
                },
              },
            },
            {
              $unwind: {
                path: '$issues',
              },
            },
            {
              $lookup: {
                from: 'col_CustomFields',
                localField: '_id',
                foreignField: 'projectId',
                as: 'projectCustomFields',
              },
            },
            {
              $project: {
                _id: 1,
                issue: '$issues',
                projectCustomFields: 1,
              },
            },
          ]);
          const projectDetail = issuesList[0];

          const selectIssue = projectDetail.issue;
          let inputParams = soapService.inputParams;

          if (inputParams)
            projectDetail.projectCustomFields.forEach((field) => {
              const searchRg = new RegExp('{{' + field.label + '}}', 'gi');
              if (inputParams.search(searchRg) > -1) {
                const issue = selectIssue.issueCustomFields.filter(
                  (x) => field._id.toString() == x.fieldId,
                );
                if (issue.length > 0) {
                  inputParams = inputParams.replace(searchRg, issue[0].value);
                  loggerInfo(inputParams);
                }
              }
            });

          const soapResponse = await HttpHelper.Execute(
           await getHttpRequestObject(soapService, inputParams),
          );
          return await processSingleSoapService({ soapService, soapResponse });
        }
      }
    } catch (error) {
      loggerError({ error });
    }
  }
};

async function processSingleSoapService({ soapService, soapResponse }) {
  let jsonSoapBody;
  if (soapService.serviceType == 'JSON') {
    jsonSoapBody = soapResponse;
  } else {
    let jsonResponse = await Parser.convertXMLToJSON(soapResponse);
    jsonSoapBody = jsonResponse['soap:Envelope']['soap:Body'];
  }

  if (soapService.decodingNode) {
    jsonSoapBody = await Parser.convertXMLToJSON(
      Parser.jsonPathToValue(jsonSoapBody, soapService.decodingNode),
    );
    loggerInfo('after decoding node');
    loggerInfo('jsonSoapBody', JSON.stringify(jsonSoapBody));
  }
  let issuesProps = [];

  if (soapService.dataNode)
    jsonSoapBody = Parser.jsonPathToValue(jsonSoapBody, soapService.dataNode);

  loggerInfo('dataNode');
  loggerInfo('jsonSoapBody', JSON.stringify(jsonSoapBody));
  if (soapService.haveMultipleRecords) {
    for (let index = 0; index < jsonSoapBody.length; index++) {
      const soapElement = jsonSoapBody[index];
      let customFields = [];

      for (const fieldMapping of soapService.fieldMapping) {
        customFields.push({
          label: fieldMapping.destination,
          value: soapElement[fieldMapping.source],
        });
      }
      issuesProps.push({
        customFields: customFields,
      });
    }
  } else {
    let customFields = [];
    for (const fieldMapping of soapService.fieldMapping) {
      customFields.push({
        label: fieldMapping.destination,
        value: jsonSoapBody[fieldMapping.source],
      });
    }
    issuesProps.push({
      customFields: customFields,
    });
  }

  loggerInfo('issuesProps');
  loggerInfo(JSON.stringify(issuesProps));

  return issuesProps;
}

async function getHttpRequestObject(soapService, inputParams) {
  var headers = soapService.customHeaders;
  if (soapService.soapAction)
    headers.push({
      headerName: 'SoapAction',
      headerValue: soapService.soapAction,
    });

    if (soapService.requirePreAuthorization) {

      var getPreAuthToken = await HttpHelper.Execute(
        {
          url: soapService.authorizatioURL,
          contentType: "application/json",
          userName: "",
          password: "",
          payload: prepareHttpPayload("JSON", soapService.authorizationRequestType, soapService.authorizationBody),
          customHeaders: [],
          requestType: soapService.authorizationRequestType
        }
      );
  
      var httpRequest = {
        url: soapService.url,
        contentType: soapService.contentType,
        userName: soapService.userName,
        password: soapService.password,
        payload: prepareHttpPayload(soapService.serviceType, soapService.requestType, inputParams || soapService.inputParams),
        customHeaders: headers,
        requestType: soapService.requestType
      }
  
      return JSON.parse(
        JSON.stringify(httpRequest)
          .replace('{{PreAuthorizationToken}}', Parser.jsonPathToValue(getPreAuthToken, soapService.authorizationTokenPath))
          .replace('{{IncrementByNumber}}', 0)
      )
  
  
    }

  return {
    url: soapService.url,
    contentType: soapService.contentType,
    userName: soapService.userName,
    password: soapService.password,
    payload: prepareHttpPayload(
      soapService.serviceType,
      soapService.requestType,
      inputParams || soapService.inputParams,
    ),
    customHeaders: headers,
    requestType: soapService.requestType,
  };
}
function prepareHttpPayload(serviceType, requestType, inputParams) {
  if (serviceType == 'JSON') {
    if (requestType != 'GET') {
      return JSON.parse(inputParams);
    }
  } else {
    return SoapFormatterHelper.wrapXmlInSoapWrapper(inputParams);
  }
}
module.exports = {
  saveSoapService,
  deleteSoapService,
  getSoapServiceMappingFields,
  getUpsertRequestFromSoapService,
};
