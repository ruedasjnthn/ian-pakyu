const mongoose = require("mongoose");

const { lexOfficeIntegration } = require('./Helper/lexOfficeIntegration')
const HttpHelper = require('./Helper/HttpHelper');
const { Project } = require("./Helper/ProjectHelper");
const { loggerInfo, loggerError } = require('./config/logger')

async function lexOfficeIntegrationProcessor() {

  let lexOfficeIntegrationList = await lexOfficeIntegration.aggregate([
    {
      $match: {
        isEnabled: true
      }
    }]);

  // $or: [{
  //   lastSyncDate: {
  //     $lte: new Date(
  //       Date.now() - 24 * 60 * 60 * 1000 - 1
  //     ),
  //   },
  // },
  // {
  //   lastSyncDate: null
  // },
  // ],

  loggerInfo("lexOfficeIntegrationProcessor: processing list ", JSON.stringify(lexOfficeIntegrationList));
  for (const lexOfficeInt of lexOfficeIntegrationList) {

    try {

      if (!lexOfficeInt.apiKey) {
        loggerInfo("lexOfficeIntegrationProcessor: lexOfficeIntegration.apiKey is empty")
        continue;
      }
      let pObjId = mongoose.Types.ObjectId(lexOfficeInt.projectId);
      loggerInfo("lexOfficeIntegrationProcessor: processing id with project id ", pObjId, lexOfficeInt._id, JSON.stringify(lexOfficeInt));

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
        try {
          loggerInfo("lexOfficeIntegrationProcessor: issue started uploading " + selectIssue._id.toString());


          const postObject = {
            "version": 0,
            "roles": {
              "customer": {
              },
              "vendor": {
              }
            },
            "company": {
              "contactPersons": [{}]
            },
            "addresses": {
              "billing": [
              ],
              "shipping": [
              ]
            },
            "emailAddresses": {
              "business": [

              ],
              "office": [

              ],
              "private": [

              ],
              "other": [

              ]
            },
            "phoneNumbers": {
              "business": [

              ],
              "office": [

              ],
              "mobile": [

              ],
              "private": [

              ],
              "fax": [

              ],
              "other": [

              ]
            }
          }

          lexOfficeInt.fieldMapping.forEach(fieldMapping => {

            const projectFieldId = projectDetail
              .projectCustomFields
              .filter(x => fieldMapping.destination == x.label);

            const issueField = selectIssue
              .issueCustomFields
              .filter(x => x.fieldId == projectFieldId[0]._id.toString())
            if (issueField.length > 0) {
              if (fieldMapping.source == 'roles.customer.number')
                postObject.roles.customer.number = issueField[0].value
              if (fieldMapping.source == 'roles.vendor.number') {
                postObject.roles.vendor.number = issueField[0].value
              }

              if (fieldMapping.source == 'company.name') {
                postObject.company.name = issueField[0].value
              }

              if (fieldMapping.source == 'company.taxNumber') {
                postObject.company.taxNumber = issueField[0].value
              }

              if (fieldMapping.source == 'company.vatRegistrationId') {
                postObject.company.vatRegistrationId = issueField[0].value
              }

              if (fieldMapping.source == 'company.allowTaxFreeInvoices') {
                postObject.company.allowTaxFreeInvoices = issueField[0].value
              }

              if (['addresses.shipping.supplement',
                'addresses.shipping.street',
                'addresses.shipping.zip',
                'addresses.shipping.city',
                'addresses.shipping.countryCode'].filter(x => x == fieldMapping.source).length > 0) {
                if (postObject.addresses.shipping.length == 0) {
                  postObject.addresses.shipping.push({})
                }
                if (fieldMapping.source == 'addresses.shipping.supplement') {
                  postObject.addresses.shipping[0].supplement = issueField[0].value
                }
                if (fieldMapping.source == 'addresses.shipping.street') {
                  postObject.addresses.shipping[0].street = issueField[0].value
                }
                if (fieldMapping.source == 'addresses.shipping.zip') {
                  postObject.addresses.shipping[0].zip = issueField[0].value
                }
                if (fieldMapping.source == 'addresses.shipping.city') {
                  postObject.addresses.shipping[0].city = issueField[0].value
                }

                if (fieldMapping.source == 'addresses.shipping.countryCode') {
                  postObject.addresses.shipping[0].countryCode = issueField[0].value
                }

              }

              if (['addresses.billing.supplement',
                'addresses.billing.street',
                'addresses.billing.zip',
                'addresses.billing.city',
                'addresses.billing.countryCode'].filter(x => x == fieldMapping.source).length > 0) {
                if (postObject.addresses.billing.length == 0) {
                  postObject.addresses.billing.push({})
                }
                if (fieldMapping.source == 'addresses.billing.supplement') {
                  postObject.addresses.billing[0].supplement = issueField[0].value
                }
                if (fieldMapping.source == 'addresses.billing.street') {
                  postObject.addresses.billing[0].street = issueField[0].value
                }
                if (fieldMapping.source == 'addresses.billing.zip') {
                  postObject.addresses.billing[0].zip = issueField[0].value
                }
                if (fieldMapping.source == 'addresses.billing.city') {
                  postObject.addresses.billing[0].city = issueField[0].value
                }

                if (fieldMapping.source == 'addresses.billing.countryCode') {
                  postObject.addresses.billing[0].countryCode = issueField[0].value
                }

              }


              if (['company.contactPersons.salutation',
                'company.contactPersons.firstName',
                'company.contactPersons.lastName',
                'company.contactPersons.primary',
                'company.contactPersons.emailAddress',
                'company.contactPersons.phoneNumber'].filter(x => x == fieldMapping.source).length > 0) {


                if (fieldMapping.source == 'company.contactPersons.salutation') {
                  postObject.company.contactPersons[0].salutation = issueField[0].value
                }
                if (fieldMapping.source == 'company.contactPersons.firstName') {
                  postObject.company.contactPersons[0].firstName = issueField[0].value
                }

                if (fieldMapping.source == 'company.contactPersons.lastName') {
                  postObject.company.contactPersons[0].lastName = issueField[0].value
                }
                if (fieldMapping.source == 'company.contactPersons.primary') {
                  postObject.company.contactPersons[0].primary = issueField[0].value
                }
                if (fieldMapping.source == 'company.contactPersons.emailAddress') {
                  postObject.company.contactPersons[0].emailAddress = issueField[0].value
                }
                if (fieldMapping.source == 'company.contactPersons.phoneNumber') {
                  postObject.company.contactPersons[0].phoneNumber = issueField[0].value
                }

              }

              if (fieldMapping.source == 'emailAddresses.business') {
                postObject.emailAddresses.business.push(issueField[0].value)
              }
              if (fieldMapping.source == 'emailAddresses.office') {
                postObject.emailAddresses.office.push(issueField[0].value)
              }
              if (fieldMapping.source == 'emailAddresses.private') {
                postObject.emailAddresses.private.push(issueField[0].value)
              }
              if (fieldMapping.source == 'emailAddresses.other') {
                postObject.emailAddresses.other.push(issueField[0].value)
              }


              if (fieldMapping.source == 'phoneNumbers.business') {
                postObject.phoneNumbers.business.push(issueField[0].value)
              }

              if (fieldMapping.source == 'phoneNumbers.office') {
                postObject.phoneNumbers.office.push(issueField[0].value)
              }
              if (fieldMapping.source == 'phoneNumbers.mobile') {
                postObject.phoneNumbers.mobile.push(issueField[0].value)
              }
              if (fieldMapping.source == 'phoneNumbers.private') {
                postObject.phoneNumbers.private.push(issueField[0].value)
              }

              if (fieldMapping.source == 'phoneNumbers.fax') {
                postObject.phoneNumbers.fax.push(issueField[0].value)
              }

              if (fieldMapping.source == 'phoneNumbers.other') {
                postObject.phoneNumbers.other.push(issueField[0].value)
              }

              if (fieldMapping.source == 'note') {
                postObject.note = issueField[0].value;
              }

              if (fieldMapping.source == 'archived') {
                postObject.archived = issueField[0].value;
              }

            }
          });

          var contactIssueMapping = lexOfficeInt.ContactIdIssueIdMapping.filter(x => x.issueId == selectIssue._id.toString());

          if (contactIssueMapping.length == 0) {

            //check for company name
            const searchbyCompanyNameResponse = await HttpHelper.Execute({
              url: "https://api.lexoffice.io/v1/contacts?name=" + postObject.company.name,
              contentType: "application/json",
              requestType: "GET",
              customHeaders: [{
                "headerName": "Authorization",
                "headerValue": "Bearer " + lexOfficeInt.apiKey
              }]
            });
        var existingContacts =    searchbyCompanyNameResponse
              .content.filter(x => x.company.name == postObject.company.name);
            if (existingContacts.length > 0) {
              var existingContact = existingContacts[0];
              postObject.version = existingContact.version
              var updateContactResponse = await HttpHelper.Execute({
                url: "https://api.lexoffice.io/v1/contacts/" + existingContact.id,
                contentType: "application/json",
                payload: postObject,
                requestType: "PUT",
                customHeaders: [{
                  "headerName": "Authorization",
                  "headerValue": "Bearer " + lexOfficeInt.apiKey
                }]
              });

              await lexOfficeIntegration.findOneAndUpdate(
                { "_id": lexOfficeInt._id, },
                {
                  "$push":
                  {
                    "ContactIdIssueIdMapping":
                    {
                      "contactId": existingContact.id,
                      "issueId": selectIssue._id.toString(),
                      "version": updateContactResponse.version,
                      "lastSyncDate": new Date()
                    }
                  }
                }
              )
            }
            else {
              const createContactResponse = await HttpHelper.Execute({
                url: "https://api.lexoffice.io/v1/contacts/",
                contentType: "application/json",
                payload: postObject,
                requestType: "POST",
                customHeaders: [{
                  "headerName": "Authorization",
                  "headerValue": "Bearer " + lexOfficeInt.apiKey
                }]
              });
              if (createContactResponse.id) {
                await lexOfficeIntegration.findOneAndUpdate(
                  { "_id": lexOfficeInt._id, },
                  {
                    "$push":
                    {
                      "ContactIdIssueIdMapping":
                      {
                        "contactId": createContactResponse.id,
                        "issueId": selectIssue._id.toString(),
                        "version": createContactResponse.version,
                        "lastSyncDate": new Date()
                      }
                    }
                  }
                )
              }

              loggerInfo("lexOfficeIntegrationProcessor: createContactResponse is" + JSON.stringify(createContactResponse))
            }

          }
          else {
            if (contactIssueMapping[0].lastSyncDate &&
              selectIssue.updatedAt > contactIssueMapping[0].lastSyncDate) {

              var contactId = contactIssueMapping[0].contactId;
              postObject.version = contactIssueMapping[0].version;
              var updateContactResponse = await HttpHelper.Execute({
                url: "https://api.lexoffice.io/v1/contacts/" + contactId,
                contentType: "application/json",
                payload: postObject,
                requestType: "PUT",
                customHeaders: [{
                  "headerName": "Authorization",
                  "headerValue": "Bearer " + lexOfficeInt.apiKey
                }]
              });

              if (updateContactResponse.id) {
                loggerInfo("lexOfficeIntegrationProcessor: updating the version" + JSON.stringify(updateContactResponse))
                await lexOfficeIntegration.findOneAndUpdate(
                  { "ContactIdIssueIdMapping._id": contactIssueMapping[0]._id },
                  {
                    $set: {
                      'ContactIdIssueIdMapping.$.version': updateContactResponse.version,
                      'ContactIdIssueIdMapping.$.lastSyncDate': new Date(),
                    }
                  });

              } else {
                if (updateContactResponse.IssueList.filter(x => x.source == "version" && x.type == 'validation_failure').length > 0) {

                  loggerInfo("lexOfficeIntegrationProcessor: version issue in the api" + JSON.stringify(updateContactResponse))

                  var getContactResponse = await HttpHelper.Execute({
                    url: "https://api.lexoffice.io/v1/contacts/" + contactId,
                    contentType: "application/json",
                    requestType: "GET",
                    customHeaders: [{
                      "headerName": "Authorization",
                      "headerValue": "Bearer " + lexOfficeInt.apiKey
                    }]
                  });

                  loggerInfo("lexOfficeIntegrationProcessor: versio updated" + JSON.stringify(getContactResponse))
                  // updating the version if version on  the service is different than we have
                  await lexOfficeIntegration.findOneAndUpdate(
                    { "ContactIdIssueIdMapping._id": contactIssueMapping[0]._id },
                    { $set: { 'ContactIdIssueIdMapping.$.version': getContactResponse.version } })


                }
              }
              // loggerInfo("lexOfficeIntegrationProcessor: httpResonse is" + JSON.stringify(httpResonse))
            }
            else {
              loggerInfo("lexOfficeIntegrationProcessor: issue already synced. no sync required.")
            }
          }

        } catch (error) {
          loggerError("lexOfficeIntegrationProcessor: issue upload error", error)
        }

      }

    } catch (error) {
      loggerError("lexOfficeIntegrationProcessor: error ", error);
    }
    finally {
      await lexOfficeIntegration.findOneAndUpdate(
        { _id: lexOfficeInt._id },
        { lastSyncDate: new Date() },
      );

    }


  }


}


module.exports = {
  lexOfficeIntegrationProcessor,
};