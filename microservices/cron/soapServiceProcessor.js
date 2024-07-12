const mongoose = require("mongoose");

const { clientGqlMutate } = require('./Helper/gqlClientHelper')
const { SoapService } = require('./Helper/SoapServiceHepler')
const { gql } = require("@apollo/client");

const Parser = require("./Helper/ParserHelper");
const HttpHelper = require('./Helper/HttpHelper');
const { Project } = require("./Helper/ProjectHelper");
const SoapFormatterHelper = require('./Helper/SoapFormatterHelper')
const { loggerInfo, loggerError } = require('./config/logger')

async function ProceessSoapServices() {

  let soapServiceList = await SoapService.aggregate([
    {
      $match: {
        isEnabled: true,
        $or: [{
          lastSyncDate: {
            $lte: new Date(
              Date.now() - 24 * 60 * 60 * 1000 - 1
            ),
          },
        },
        {
          lastSyncDate: null
        },
        ],
      }
    }]);

  loggerInfo("ProceessSoapServices: processing list ", JSON.stringify(soapServiceList));
  for (const soapService of soapServiceList) {

    try {
      if (soapService.url && soapService.contentType) {
        if (soapService.repeatForEveryIssue) {
          let pObjId = mongoose.Types.ObjectId(soapService.projectId);

          loggerInfo("ProceessSoapServices: processing id with project id ", pObjId, soapService._id, JSON.stringify(soapService));
          var issuesList = await Project.aggregate([{
            $match: {
              _id: pObjId
            }
          }, {
            $lookup: {
              from: 'col_Issues',
              localField: '_id',
              foreignField: 'projectId',
              as: 'issues'
            }
          }, {
            $lookup: {
              from: 'col_CustomFields',
              localField: '_id',
              foreignField: 'projectId',
              as: 'projectCustomFields'
            }
          }, {
            $project: {
              _id: 1,
              issues: 1,
              projectCustomFields: 1
            }
          }]);
          const projectDetail = issuesList[0];
          for (let index = 0; index < projectDetail.issues.length; index++) {
            const selectIssue = projectDetail.issues[index];
            let inputParams = soapService.inputParams;

            if (inputParams)
              projectDetail.projectCustomFields.forEach(field => {
                const searchRg = new RegExp("{{" + field.label + "}}", 'gi');
                if (inputParams.search(searchRg) > -1) {
                  const issue = selectIssue.issueCustomFields.filter(x => field._id.toString() == x.fieldId);
                  if (issue.length > 0) {
                    inputParams = inputParams.replace(searchRg, issue[0].value);
                    loggerInfo(inputParams);
                  }

                }
              });

            await connectServerAndProcess(soapService, inputParams, soapService.url)
          }
        } else {
          await connectServerAndProcess(soapService, null, soapService.url)
        }




      }
    } catch (error) {
      loggerError("ProceessSoapServices: error ", error);
    }


  }


}

async function connectServerAndProcess(soapService, inputParams, soapDataUrl) {
  // loggerInfo("ProceessSoapServices: sendng request ", soapService._id,);
  // const soapResponse = await HttpHelper.Execute(await getHttpRequestObject(soapService));
  // loggerInfo("ProceessSoapServices: updating ", soapService._id,);
  // await updateSoapServiceLastSyncDate(soapService._id);
  // loggerInfo("ProceessSoapServices: calling processSingleSoapService ", soapService._id,);
  // await processSingleSoapService({ soapService, soapResponse })
  if (soapDataUrl) {
    if (soapService.supportPaging) {
      if (!isNaN(parseInt(soapService.incrementPageBy))) {
        if (soapService.url.indexOf("{{IncrementByNumber}}") > -1) {
          let pageIncrement = 0;
          while (pageIncrement > -1) {
            loggerInfo("ProceessSoapServices: sendng request ", soapService._id,);
            const soapResponse = await HttpHelper
              .Execute(await getHttpRequestObject({ soapService, inputParams, pageIncrementBy: pageIncrement }));
            loggerInfo("ProceessSoapServices: updating ", soapService._id,);

            await updateSoapServiceLastSyncDate(soapService._id);
            loggerInfo("ProceessSoapServices: calling processSingleSoapService ", soapService._id,);
            if (await processSingleSoapService({ soapService, soapResponse })) {
              pageIncrement = pageIncrement + parseInt(soapService.incrementPageBy)
            } else {
              pageIncrement = -1
            }
          }

        } else {
          loggerInfo("ProceessSoapServices: {{IncrementByNumber}} placeholder does not exists ", soapService._id,);
        }

      }
      else {
        loggerInfo("ProceessSoapServices: invalid incrementPageBy ", soapService._id,);
      }
    } else {
      loggerInfo("ProceessSoapServices: sendng request ", soapService._id,);
      const soapResponse = await HttpHelper
        .Execute(await getHttpRequestObject({ soapService, inputParams }));
      loggerInfo("ProceessSoapServices: updating ", soapService._id,);

      await updateSoapServiceLastSyncDate(soapService._id);
      loggerInfo("ProceessSoapServices: calling processSingleSoapService ", soapService._id,);
      await processSingleSoapService({ soapService, soapResponse })
    }

  }


}
async function updateSoapServiceLastSyncDate(id) {
  await SoapService.findOneAndUpdate(
    { _id: id },
    { lastSyncDate: new Date() },
  );
}

async function processSingleSoapService({ soapService, soapResponse }) {

  let jsonSoapBody;
  if (soapService.serviceType == "JSON") {
    jsonSoapBody = soapResponse;
  } else {
    let jsonResponse = await Parser.convertXMLToJSON(soapResponse);
    jsonSoapBody = jsonResponse["soap:Envelope"]['soap:Body'];
  }



  if (soapService.decodingNode) {
    jsonSoapBody = await Parser.convertXMLToJSON(Parser.jsonPathToValue(jsonSoapBody, soapService.decodingNode));
    loggerInfo("after decoding node");
    loggerInfo("jsonSoapBody", JSON.stringify(jsonSoapBody));
  }

  let issuesProps = [];


  if (soapService.dataNode)
    jsonSoapBody = Parser.jsonPathToValue(jsonSoapBody, soapService.dataNode);

  loggerInfo("dataNode");
  loggerInfo("jsonSoapBody", JSON.stringify(jsonSoapBody));
  if (soapService.haveMultipleRecords) {
    for (let index = 0; index < jsonSoapBody.length; index++) {
      const soapElement = jsonSoapBody[index];
      let customFields = [];

      for (const fieldMapping of soapService.fieldMapping) {
        if (soapElement[fieldMapping.source] && fieldMapping.destination && soapElement[fieldMapping.source] 
          && (typeof soapElement[fieldMapping.source] === 'number' || 
          typeof soapElement[fieldMapping.source] === 'string' ||
          typeof soapElement[fieldMapping.source] === 'boolean')) {
          customFields.push({ label: String(fieldMapping.destination), value: String(soapElement[fieldMapping.source]) })
        } else {
          loggerInfo("ProceessSoapServices: ", fieldMapping.destination + " is null");
        }
      }
      issuesProps.push({
        "customFields": customFields,
        "status": soapService.upsertIssueStatus
      })

    }
  } else {
    let customFields = [];
    for (const fieldMapping of soapService.fieldMapping) {
      if (soapElement[fieldMapping.source] && fieldMapping.destination && jsonSoapBody[fieldMapping.source] && 
        (typeof jsonSoapBody[fieldMapping.source] === 'number' ||
        typeof jsonSoapBody[fieldMapping.source] === 'string' ||
        typeof jsonSoapBody[fieldMapping.source] === 'boolean')) {
        customFields.push({ label: String(fieldMapping.destination), value: String(jsonSoapBody[fieldMapping.source]) })
      }
      else {
        loggerInfo("ProceessSoapServices: ",fieldMapping.destination + " is null");
      }
    }
    issuesProps.push({
      "customFields": customFields,
      "status": soapService.upsertIssueStatus
    })
  }

  loggerInfo("ProceessSoapServices: issuesProps",JSON.stringify(issuesProps));

  if (issuesProps.length > 0) {

    for (i = 0; i <= issuesProps.length; i = i + 10) {
      loggerInfo("upserting " + i + " to " + (i + 10))
      const mutationObject = {
        mutation: gql`
          mutation UpsertIssue($projectId: ID!, $issuesProps: [UpsertIssueProps]) {
            upsertIssue(projectId: $projectId, issuesProps: $issuesProps) {
              id
            }
          }

             `,
        variables:
        {
          "projectId": soapService.projectId,
          "issuesProps": issuesProps.slice(i, i + 10)
        },
      }

      const { data, errors } = await clientGqlMutate(mutationObject);
      loggerInfo("ProceessSoapServices: upserting Response", data, errors);
    }

  }

  if (soapService.haveMultipleRecords) {
    return jsonSoapBody.length > 0;
  }
  else {
    return jsonSoapBody
  }
}


async function getHttpRequestObject({ soapService, inputParams, pageIncrementBy }) {

  var soapUrl = soapService.url
  var headers = soapService.customHeaders;
  if (soapService.soapAction)
    headers.push({
      headerName: "SoapAction",
      headerValue: soapService.soapAction
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
      url: soapUrl,
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
        .replace('{{IncrementByNumber}}', pageIncrementBy)
    )


  } else {
    const httpRequest = {
      url: soapUrl,
      contentType: soapService.contentType,
      userName: soapService.userName,
      password: soapService.password,
      payload: prepareHttpPayload(soapService.serviceType, soapService.requestType, inputParams || soapService.inputParams),
      customHeaders: headers,
      requestType: soapService.requestType
    }

    return JSON.parse(
      JSON.stringify(httpRequest)
        .replace('{{IncrementByNumber}}', pageIncrementBy)
    )

  }


}
function prepareHttpPayload(serviceType, requestType, inputParams) {
  if (serviceType == "JSON") {
    if (requestType != "GET") {
      return JSON.parse(inputParams)
    }
  } else {
    return SoapFormatterHelper.wrapXmlInSoapWrapper(inputParams)
  }
}


module.exports = {
  ProceessSoapServices,
};