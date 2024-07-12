require('isomorphic-fetch');
const { loggerError } = require('../config/logger');
const { formatEventCategoriesFromOutlook } = require('./EventHelper')

const getOutlookCategories = async (client) => {
  let categories = []
  const results = await client.api(`/me/outlook/masterCategories`)
    .get();
  categories = results && results.value || []
  let nextLink = results['@odata.nextLink']

  while (nextLink) {
    const nextResults = await client.api(nextLink).get();
    categories = [...categories, ...nextResults ? nextResults.value : []]
    nextLink = nextResults['@odata.nextLink']
  }

  return formatEventCategoriesFromOutlook(categories)
}

const createOutlookCategory = async (client, { displayName, color }) => {
  try {
    const createdCategory = await client.api('/me/outlook/masterCategories')
      .post({ displayName, color });

    return createdCategory
  } catch (e) {
    loggerError('createOutlookCategory err', { e })
    return null
  }
}

const updateOutlookCategory = async (client, { id, color }) => {
  try {
    const updatedCategory = await client.api(`/me/outlook/masterCategories/${id}`)
      .update({ color });

    return updatedCategory
  } catch (e) {
    loggerError('updateOutlookCategory err', { e })
    return null
  }
}

const deleteOutlookCategory = async (client, id) => {
  try {
    await client.api(`/me/outlook/masterCategories/${id}`)
      .delete();

    return true
  } catch (e) {
    loggerError('deleteOutlookCategory err', { e })
    return false
  }
}

const formatCategoryToCoc = (category) => {
  return {
    displayName: category.displayName || category.title,
    color: category.outlookColor || category.color,
    accountId: category.accountId,
    outlookCategoryId: category.id,
    origin: category.origin,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    deletedAt: category.deletedAt,
  }
}

module.exports = {
  getOutlookCategories,
  createOutlookCategory,
  updateOutlookCategory,
  deleteOutlookCategory,
  formatCategoryToCoc
};
