
const mongoose = require('mongoose');

const getSoapServices = async (_, { projectId }, { models }) => {
    let soapServiceList = await models.SoapService.find({ projectId: projectId });

    if (soapServiceList) {
        return soapServiceList.map((soapService) => {
            return toServiceObject(soapService)
        })
    }
    return [];
};

const getSoapService = async (_, { soapServiceId }, { models }) => {
    let soapService = await models.SoapService.findById(soapServiceId);

    if (soapService) {
        return toServiceObject(soapService)
    }
    return null;

};

const toServiceObject = (soapService) => {
        return {
            projectId: soapService.projectId,
            userName: soapService.userName,
            url: soapService.url,
            soapAction: soapService.soapAction,
            inputParams: soapService.inputParams,
            fieldMapping: soapService.fieldMapping,
            contentType: soapService.contentType,
            dataNode: soapService.dataNode,
            haveMultipleRecords: soapService.haveMultipleRecords,
            id: soapService._id,
            name: soapService.name,
            password: soapService.password,
            decodingNode: soapService.decodingNode,
            xmlMappingKeys: soapService.xmlMappingKeys,
            isEnabled: soapService.isEnabled,
            repeatForEveryIssue: soapService.repeatForEveryIssue,
            serviceType: soapService.serviceType,
            requestType: soapService.requestType,
            customHeaders: soapService.customHeaders,
            supportPaging: soapService.supportPaging || false,
            incrementPageBy: soapService.incrementPageBy,
            requirePreAuthorization: soapService.requirePreAuthorization || false,
            authorizatioURL: soapService.authorizatioURL,
            authorizationRequestType: soapService.authorizationRequestType,
            authorizationBody: soapService.authorizationBody,
            authorizationTokenPath: soapService.authorizationTokenPath,
            upsertIssueStatus: soapService.upsertIssueStatus
        } 
   
}

module.exports = {
    getSoapService,
    getSoapServices
}