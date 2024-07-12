require('isomorphic-fetch');
const { Project, OutlookSync, OutlookCategory } = require('../models');
const { loggerInfo, loggerError } = require('../config/logger');
const { isSameId } = require('./StringHelper');
const mongoose = require('mongoose')

const getProjectCategories = async ({ projectId, excluded }) => {
  try {
    const projectFound = await Project.findById(
      projectId,
      'outlook eventCategories',
    );
    const outlookSyncFound = await OutlookSync.findOne(
      { projectId },
      'categoriesSyncedAt',
    );
    const projectOutlook = projectFound.outlook;
    const hasCategoriesSynced =
      outlookSyncFound && outlookSyncFound.categoriesSyncedAt;
    const projectEventCategories = projectFound.eventCategories;
    const categoriesList = [];

    if (hasCategoriesSynced) {
      const categoriesFound = await OutlookCategory.find({
        accountId: projectOutlook.accountId,
        deletedAt: null,
        ...excluded && {
          projectIdsExcludedInSync: { $in: [projectId] }
        }
      });
      for (const coc of categoriesFound) {
        const pec = projectEventCategories.find(
          (pec) => String(pec.categoryId) === String(coc._id),
        );

        categoriesList.push({
          id: coc._id,
          displayName: coc.displayName,
          color: coc.color,
          createdAt: coc.createdAt,
          updatedAt: coc.updatedAt,
          deletedAt: coc.deletedAt,
          projectEventCategoryId: pec && pec._id,
          excludeInSync: !!coc.projectIdsExcludedInSync?.find(pId => isSameId(pId, projectId))
        });
      }
    } else {
      for (const coc of projectEventCategories) {
        if (!excluded || (excluded && coc.excludeInSync))
          categoriesList.push({
            id: coc._id,
            displayName: coc.title,
            color: coc.outlookColor || coc.presetColor,
            outlookCategoryId: coc.outlookCategoryId,
            createdAt: coc.createdAt,
            updatedAt: coc.updatedAt,
            deletedAt: coc.deletedAt,
            excludeInSync: coc.excludeInSync
          });
      }
    }

    loggerInfo('----getProjectCategories---', {
      outlookSyncFound,
      hasCategoriesSynced,
      categoriesList
    });
    return [...categoriesList].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  } catch (e) {
    loggerError('ERROR! projectCategories', { e });
    return e;
  }
};

const getExcludedInSyncCategories = ({ projectCategories, projectId }) => {
  const categoriesIds = []

  for (const category of projectCategories) {
    const categsExcludedPIds = category.projectIdsExcludedInSync || []
    const projectIdExcluded = categsExcludedPIds.find(pId => isSameId(pId, projectId))
    const isExcludedInProject = !!projectIdExcluded || category.excludeInSync
    loggerInfo('getExcludedInSyncCategories', {
      projectIdExcluded,
      category,
      categsExcludedPIds,
      projectId,
      isExcludedInProject
    })
    if (isExcludedInProject) {
      const categId = category.id || category._id
      const projectEventCategoryId = category.projectEventCategoryId

      if (categId) categoriesIds.push(mongoose.Types.ObjectId(categId))
      if (projectEventCategoryId) categoriesIds.push(mongoose.Types.ObjectId(projectEventCategoryId))
    }
  }

  loggerInfo('getExcludedInSyncCategories', {
    categoriesIds
  })

  return categoriesIds
}



module.exports = {
  getProjectCategories,
  getExcludedInSyncCategories
};
