require('isomorphic-fetch');
const { ApolloError } = require('apollo-server-express');
const { loggerLog, loggerError } = require('../config/logger');

const getMailFolders = async (client) => {
  try {
    const response = await client.api('/me/mailFolders?$top=80').get();
    if (!response) {
      loggerError('response is null')
      return []
    }

    let mailFolders = response["value"] || []

    let nextLink = response['@odata.nextLink']

    while (nextLink) {
      const nextResponse = await client.api(nextLink).get();
      loggerLog({ nextResponse })
      nextLink = nextResponse['@odata.nextLink']
      const nextMailFolders = nextResponse["value"] || []
      mailFolders = [...mailFolders, ...nextMailFolders]
    }

    loggerLog({ response })
    return mailFolders
  } catch (err) {
    loggerError({ err })
    return []
  }
}

const getMailFolder = async (client, folderId) => {
  try {
    const response = await client.api(`/me/mailFolders/${folderId}`).get();

    if (!response) throw new ApolloError('response_is_null')

    loggerLog({ response })
    return response

  } catch (err) {

    loggerError({ err })
    return null
  }
}

const getMailFolderFilterName = async (client, displayName) => {
  try {
    const response = await client
      .api(`/me/mailFolders?$filter=startswith(displayName, '${displayName}')`)
      .get()

    const values = response && response['value'] || []
    const matchingFolder = values.find(v => v.displayName === displayName)

    loggerLog({ response, matchingFolder })
    return matchingFolder

  } catch (err) {

    loggerError({ err })
    return null
  }
}

const getMailChildFolders = async (client, parentFolderId) => {
  try {
    const response = await client.api(`/me/mailFolders/${parentFolderId}/childFolders?$top=80`).get();
    if (!response) {
      loggerError('response is null')
      return []
    }

    let mailChildFolders = response["value"] || []

    let nextLink = response['@odata.nextLink']
    loggerLog({ response, nextLink })

    while (nextLink) {
      const nextResponse = await client.api(nextLink).get();
      loggerLog({ nextResponse })
      nextLink = nextResponse['@odata.nextLink']
      const nextMailFolders = (nextResponse && nextResponse["value"]) || []
      mailChildFolders = [...mailChildFolders, ...nextMailFolders]
    }

    loggerLog({ mailChildFolders })
    return mailChildFolders
  } catch (err) {
    loggerError({ err })
    return []
  }
}

const createMailFolder = async (client, displayName, isHidden) => {
  try {
    const mailFolder = {
      displayName: displayName || '',
      isHidden: Boolean(isHidden)
    };
    const response = await client.api(`/me/mailFolders`).post(mailFolder);

    if (!response) {
      loggerError('createMailFolder response is null')
    }

    loggerLog({ response })
    return response
  } catch (err) {
    loggerError({ err })
  }
}

const createMailChildFolder = async (client, parentFolderId, displayName, isHidden) => {
  try {
    loggerLog('---createMailChildFolder')
    const mailFolder = {
      displayName: displayName || '',
      isHidden: Boolean(isHidden)
    };
    loggerLog({ mailFolder })


    const response = await client.api(`/me/mailFolders/${parentFolderId}/childFolders`)
      .post(mailFolder);

    if (!response) loggerError('createMailChildFolder response is null')

    return response

  } catch (err) {
    loggerError('createMailChildFolder', { err })
    return null

  }
}

const getAktenplatzMailFolderInOutlook = async (client, projectId,) => {
  try {
    const aktenplatzFolderName = 'aktenplatz'
    const aktenplatzFolder = await getMailFolderFilterName(client, aktenplatzFolderName)

    loggerLog({ aktenplatzFolder })

    if (aktenplatzFolder) return aktenplatzFolder
    else {
      const createdAktenplatzFolder = await createMailFolder(client, aktenplatzFolderName)
      return createdAktenplatzFolder
    }

  } catch (error) {
    loggerError('createAktenplatzMailFolderInOutlook', { error })
    return null
  }
}

const getFolderMessages = async (client, parentFolderId, isImmutableId) => {
  try {
    loggerLog('---getFolderMessages')

    const callApiGet = async (link) =>
      isImmutableId
        ? await client.api(link).header("Prefer", "IdType=\"ImmutableId\"").get()
        : await client.api(link).get();

    const response = await callApiGet(`/me/mailFolders/${parentFolderId}/messages?$top=80`)

    let folderMessages = (response && response['value']) || []

    loggerLog('getFolderMessages', { response, folderMessages })

    let nextLink = response['@odata.nextLink']

    while (nextLink) {
      const nextResponse = await callApiGet(nextLink);
      loggerLog('getFolderMessages', { nextResponse })
      nextLink = nextResponse['@odata.nextLink']
      const nextFolderMessages = (nextResponse && nextResponse["value"]) || []
      folderMessages = [...folderMessages, ...nextFolderMessages]
    }

    return folderMessages

  } catch (err) {
    loggerError('getFolderMessages', { err })
    return []
  }
}

module.exports = {
  getMailFolders,
  getMailFolder,
  getMailChildFolders,
  createMailFolder,
  createMailChildFolder,
  getAktenplatzMailFolderInOutlook,
  getFolderMessages,
  getMailFolderFilterName
};
