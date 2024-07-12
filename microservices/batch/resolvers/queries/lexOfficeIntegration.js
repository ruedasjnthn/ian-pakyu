
const mongoose = require('mongoose');

const getLexOfficeIntegrations = async (_, { projectId }, { models }) => {
    let serviceList = await models.lexOfficeIntegration.find({ projectId: projectId });

    if (serviceList) {
        return serviceList.map((service) => {
            return toServiceObject(service)
        })
    }
    return [];
};

const getLexOfficeIntegration = async (_, { lexOfficeIntegrationId }, { models }) => {
    let soapService = await models.lexOfficeIntegration.findById(lexOfficeIntegrationId);

    if (soapService) {
        return toServiceObject(soapService)
    }
    return null;

};

const toServiceObject = (service) => {
        return {
            projectId: service.projectId,
            apiKey: service.apiKey,
            fieldMapping: service.fieldMapping,
            id: service._id,
            name: service.name,
            isEnabled: service.isEnabled,
        } 
   
}

module.exports = {
    getLexOfficeIntegration,
    getLexOfficeIntegrations
}