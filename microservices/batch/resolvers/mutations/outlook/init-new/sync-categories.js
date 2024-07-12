const { getMe } = require('../../../../helper/AuthHelper');
const { getOutlookCategories, createOutlookCategory, updateOutlookCategory, deleteOutlookCategory } = require('../../../../helper/OutlookCategoryHelper');
const { ApolloError } = require('apollo-server-express');
const { CategoryOrigin, OutlookCategoryPresetColors } = require('../../../../constants/category');
const { isDisplayNameSame } = require('../../../../helper/SyncHelper');
const moment = require('moment')
const mongoose = require('mongoose');
const { loggerInfo, loggerError } = require('../../../../config/logger');

const syncCategories = async ({
  models,
  client,
  categoriesSyncedAt,
  projectEventCategories,
  projectId,
  outlookAccountId,
}) => {
  loggerInfo('---syncCategories---')

  let accountId = outlookAccountId;

  // if there is no accountId saved fetch it 
  if (!Boolean(accountId)) {
    const outlookAccount = await getMe(client)
    loggerInfo({ outlookAccount })
    accountId = outlookAccount.accountId
    await models.Project.updateOne(
      { _id: projectId },
      { $set: { 'outlook.accountId': accountId } }
    )
  }

  if (!accountId) throw new ApolloError('Account Id is Null')
  const outlookCategories = await getOutlookCategories(client);

  loggerInfo({ outlookCategories, projectEventCategories, accountId })
  const newlyCreatedCocIds = []

  // for first time syncing of categories
  if (!Boolean(categoriesSyncedAt)) {
    loggerInfo('---- create coCategories  for the firstTme -----')

    const colOutlookCategoriesForDcf = await models.OutlookCategory.find({
      accountId: accountId || '0'
    })

    loggerInfo({ colOutlookCategoriesForDcf })

    // get date custom fields
    const dateCustomFields = await models.CustomField.find({
      projectId,
      type: 'date',
      deletedAt: null,
    })

    const cfcUpdateBulkOps = []
    const cocToCreateBulkOps = []
    const cocToUpdateExclusionOps = []

    for (const dcf of dateCustomFields) {
      const hasCategory = !!dcf.categoryId
      const cocFromId = hasCategory && colOutlookCategoriesForDcf.find(coc => coc._id === dcf.categoryId)
      const cocFromDisplayName = colOutlookCategoriesForDcf.find(coc =>
        isDisplayNameSame(coc.displayName, dcf.label)
      )

      const coc = cocFromId || cocFromDisplayName
      if (coc) {
        const isDNameSame = isDisplayNameSame(coc.displayName, dcf.label)
        const isColorSame = coc.color === dcf.presetColor

        if (!isDNameSame || !isColorSame)
          cfcUpdateBulkOps.push({
            updateOne: {
              filter: {
                _id: mongoose.Types.ObjectId(dcf._id)
              },
              update: {
                categoryId: coc._id,
                label: coc.displayName,
                presetColor: coc.color,
                updatedAt: new Date()
              },
            }
          })

      } else {
        const categoryId = mongoose.Types.ObjectId()
        const color = dcf.presetColor || OutlookCategoryPresetColors.PRESET_0;

        newlyCreatedCocIds.push(categoryId)
        cocToCreateBulkOps.push({
          insertOne: {
            document: {
              _id: categoryId,
              displayName: dcf.label,
              color,
              accountId,
              origin: CategoryOrigin.CUSTOM_FIELDS,
              createdAt: new Date(),
              ...dcf.hideFromCalendar && { projectIdsExcludedInSync: [projectId] }
            }
          }
        })

        cfcUpdateBulkOps.push({
          updateOne: {
            filter: {
              _id: mongoose.Types.ObjectId(dcf._id)
            },
            update: {
              categoryId: categoryId,
              presetColor: color,
              updatedAt: new Date()
            },
          }
        })
      }
    }

    const pecUpdateBulkOps = []

    const colOutlookCategoriesForPec = await models.OutlookCategory.find({
      accountId: accountId || '0',
    })

    loggerInfo({
      colOutlookCategoriesForPec
    })

    for (const pec of projectEventCategories) {
      const hasCategory = !!pec.categoryId
      const cocFromId = hasCategory && colOutlookCategoriesForPec.find(coc => coc._id === pec.categoryId)
      const cocFromDisplayName = colOutlookCategoriesForPec.find(coc =>
        isDisplayNameSame(coc.displayName, pec.title)
      )

      const coc = cocFromId || cocFromDisplayName

      loggerInfo('pec', { coc })

      if (coc) {
        const isDNameSame = isDisplayNameSame(coc.displayName, pec.title)
        const isColorSame = coc.color === pec.presetColor
        loggerInfo('coc', {
          isDNameSame,
          isColorSame,
          '!isDNameSame || !isColorSame': !isDNameSame || !isColorSame,
        })

        pecUpdateBulkOps.push({
          updateOne: {
            filter: {
              _id: mongoose.Types.ObjectId(projectId),
              'eventCategories._id': mongoose.Types.ObjectId(pec._id)
            },
            update: {
              $set: {
                'eventCategories.$.categoryId': coc._id,
                'eventCategories.$.title': coc.displayName,
                'eventCategories.$.presetColor': coc.color,
              }
            },
          }
        })

        if (pec.excludeInSync)
          cocToUpdateExclusionOps.push({
            updateOne: {
              filter: {
                _id: mongoose.Types.ObjectId(coc._id),
              },
              update: {
                $addToSet: {
                  projectIdsExcludedInSync: { $each: [projectId] }
                }
              },
            }
          })

      } else {
        const categoryId = mongoose.Types.ObjectId()
        newlyCreatedCocIds.push(categoryId)
        cocToCreateBulkOps.push({
          insertOne: {
            document: {
              _id: categoryId,
              displayName: pec.title,
              color: pec.presetColor || OutlookCategoryPresetColors.PRESET_0,
              accountId,
              origin: CategoryOrigin.EVENT_CATEGORIES,
              createdAt: new Date(),
              ...pec.excludeInSync && { projectIdsExcludedInSync: [projectId] }
            }
          }
        })
        pecUpdateBulkOps.push({
          updateOne: {
            filter: {
              _id: mongoose.Types.ObjectId(projectId),
              'eventCategories._id': mongoose.Types.ObjectId(pec._id)
            },
            update: {
              $set: {
                'eventCategories.$.categoryId': categoryId,
              }
            },
          }
        })
      }
    }


    loggerInfo({
      newlyCreatedCocIds,
      // cocToCreateBulkOps: JSON.stringify(cocToCreateBulkOps),
      pecUpdateBulkOps: JSON.stringify(pecUpdateBulkOps),
      // cfcUpdateBulkOps: JSON.stringify(cfcUpdateBulkOps),
    })
    await models.OutlookCategory.bulkWrite([...cocToCreateBulkOps, ...cocToUpdateExclusionOps])
    await models.Project.bulkWrite(pecUpdateBulkOps)
    await models.CustomField.bulkWrite(cfcUpdateBulkOps)
  }



























  //    ---- COMPARE CATEGORIES FROM DB AND OUTLOOK

  // // Oc == col_outlookCategories categories
  // // Pe == project event categories
  // // Cf == custom field categories
  // // O == outlook categories
  // const toCreateInOc = outlookCategories.filter(oc =>
  //   !colOutlookCategories.find(coc => coc.displayName === oc.displayName))

  // const toUpdateInOc = outlookCategories.filter(oc =>
  //   colOutlookCategories.find(coc => !coc.deletedAt && coc.displayName === oc.displayName))

  // const toCreateInO = colOutlookCategories.filter(coc => 
  // !outlookCategories.find(oc => oc.displayName === oc.displayName))

  // const toUpdateInO = colOutlookCategories.filter(coc => !!coc.deletedAt)
  // const toDeleteInO = colOutlookCategories.filter(coc => !!coc.deletedAt)

  // const dateCustomFieldCategories = await models.CustomField.find({
  //   projectId,
  //   type: FieldTypes.DATE,
  // })

  // const dateCustomFieldCategories = await models.CustomField.find({
  //   projectId,
  //   type: FieldTypes.DATE,
  // })












  // //    get categories from custom_fields 
  // const dateCustomFieldCategories = await models.CustomField.find({
  //   projectId,
  //   type: FieldTypes.DATE,
  // })

  // //    get categories from event_categories and push to col_outlookCategories collection in db 
  // const dbCategories = [
  //   ...projectEventCategories.map(c => ({
  //     displayName: c.title,
  //     color: c.outlookColor,
  //     accountId,
  //     origin: CategoryOrigin.EVENT_CATEGORIES,
  //     createdAt: new Date(),
  //     deleted: !!c.deletedAt
  //   })),
  //   ...dateCustomFieldCategories.map(c => ({
  //     displayName: c.label,
  //     color: c.color || getRandomOutlookCategoryPresetColor(),
  //     accountId,
  //     origin: CategoryOrigin.CUSTOM_FIELDS,
  //     createdAt: new Date(),
  //     deleted: !!c.deletedAt
  //   }))
  // ]

  // // initialize categories to create, update in outlookCategories collection
  // const categoriesToCreate = dbCategories.filter(c =>
  //   !c.deleted && !colOutlookCategories.find(oc => c.displayName === oc.displayName))

  // const categoriesToUpdate = dbCategories.filter(c =>
  //   colOutlookCategories.find(oc => c.displayName === oc.displayName))
  // // const categoriesToDelete = dbCategories.filter(c => c.deleted)

  // // and push to col_outlookCategories collection in db
  // await models.OutlookCategory.create(categoriesToCreate)

  // await models.OutlookCategory.updateMany(categoriesToUpdate)
  // }

  // const colOutlookCategories2 = await models.OutlookCategory.find({
  //   accountId
  // })



  //   //    push categories from customFieldCategories and eventCategories 
  //   //      to col_outlookCategories collection in db

  //   //    get categories from outlook and push to a new list outlookCategories 

  const colOutlookCategories = await models.OutlookCategory.find({
    accountId: accountId || '0'
  })

  // LEGEND
  // Coc == col_outlookCategories categories
  // Pec == project event categories
  // Cfc == custom field categories
  // Olc == outlook categories


  const cocToCreate = []
  const cocToCreateInOlc = []

  const cocToUpdateBulkOps = []
  const cocToUpdateInOlc = []

  const cocToDelete = []
  const cocToDeleteInOlc = []

  // find olc not in coc to create
  for (const olc of outlookCategories) {
    const cocWithId = colOutlookCategories.find(coc => coc.outlookCategoryId === olc.id)
    const cocWithName = colOutlookCategories.find(coc => isDisplayNameSame(olc.displayName, coc.displayName))
    const coc = cocWithId || cocWithName
    if (!coc) {
      cocToCreate.push({
        displayName: olc.displayName,
        color: olc.color,
        accountId,
        outlookCategoryId: olc.id,
        origin: CategoryOrigin.OUTLOOK,
        createdAt: new Date(),
      })
    }
  }

  for (const coc of colOutlookCategories) {

    const olcWithId = outlookCategories.find(olc => olc.id === coc.outlookCategoryId)
    const olcWithName = outlookCategories.find(olc => isDisplayNameSame(olc.displayName, coc.displayName))

    const olc = olcWithId || olcWithName

    // if coc is in olc
    if (olc) {
      const isSameName = isDisplayNameSame(coc.displayName, olc.displayName)
      const isSameColor = coc.color === olc.color
      const isModified = !isSameName || !isSameColor
      const isUpdatedInAktenpaltz = isModified && !!coc.updatedAt && moment(coc.updatedAt).isAfter(categoriesSyncedAt)
      const isUpdatedInOutlook = isModified && (!coc.updatedAt || (!!coc.updatedAt && moment(coc.updatedAt).isSameOrBefore(categoriesSyncedAt)))

      if (coc.deletedAt) {

        if (isUpdatedInOutlook) {
          cocToUpdateBulkOps.push({
            updateOne: {
              filter: { _id: mongoose.Types.ObjectId(coc._id) },
              update: {
                displayName: olc.displayName,
                color: olc.color,
                outlookCategoryId: olc.id,
                categoryId: coc._id,
                updatedAt: new Date(),
                deletedAt: null,
              }
            }
          })
        } else {
          cocToDeleteInOlc.push({
            displayName: olc.displayName,
            outlookCategoryId: olc.id,
            categoryId: coc._id,
          })
        }

      } else {

        if (isModified) {

          if (isUpdatedInOutlook) {
            cocToUpdateBulkOps.push({
              updateOne: {
                filter: { _id: mongoose.Types.ObjectId(coc._id) },
                update: {
                  displayName: olc.displayName,
                  color: olc.color,
                  outlookCategoryId: olc.id,
                  categoryId: coc._id,
                  updatedAt: new Date()
                }
              }
            })

          } else {

            // cocToUpdateInOlc.push({
            //   displayName: coc.displayName,
            //   color: coc.color,
            //   categoryId: coc.id,
            //   outlookCategoryId: olc.id,
            // })

            if (isSameName && !isSameColor) {
              cocToUpdateInOlc.push({
                displayName: coc.displayName,
                color: coc.color,
                categoryId: coc._id,
                outlookCategoryId: olc.id,
              })
            } else if (!isSameName) {
              if (coc.outlookCategoryId) {
                cocToDeleteInOlc.push({
                  displayName: coc.displayName,
                  categoryId: coc._id,
                  outlookCategoryId: coc.outlookCategoryId,
                  toUpdateCoc: true
                })
              }
              cocToCreateInOlc.push({
                displayName: coc.displayName,
                color: coc.color,
                categoryId: coc._id,
              })
            }
          }
        }
      }

    } else {
      // if coc is not in olc
      if (coc.outlookCategoryId) {
        cocToDelete.push({
          displayName: coc.displayName,
          outlookCategoryId: coc.outlookCategoryId,
          categoryId: coc._id,
          color: coc.color,

        })
      } else {
        cocToCreateInOlc.push({
          displayName: coc.displayName,
          color: coc.color,
          categoryId: coc._id,
        })
      }
    }
  }

  loggerInfo('\n---------------------------------------\n-----------------------------------\n', {
    lengths: {
      cocToCreateInOlcLength: cocToCreateInOlc.length,
      cocToUpdateLength: cocToUpdateBulkOps.length,
      cocToUpdateInOlcLength: cocToUpdateInOlc.length,
      cocToDeleteLength: cocToDelete.length,
      cocToDeleteInOlcLength: cocToDeleteInOlc.length,
      cocToCreateLength: cocToCreate.length,
    },
    cocToCreateInOlc,
    // cocToUpdate: cocToUpdateBulkOps,
    cocToUpdateInOlc,
    cocToDelete: cocToDelete,
    cocToDeleteInOlc,
    // cocToCreate
  })


  // cocToCreateInOlc
  for (const coc of cocToCreateInOlc) {
    const createdOlc = await createOutlookCategory(client, {
      displayName: coc.displayName,
      color: coc.color
    })
    loggerInfo({ createdOlc })

    if (createdOlc) {
      cocToUpdateBulkOps.push({
        updateOne: {
          filter: { _id: mongoose.Types.ObjectId(coc.categoryId) },
          update: {
            displayName: createdOlc.displayName,
            color: createdOlc.color,
            outlookCategoryId: createdOlc.id,
            updatedAt: new Date()
          }
        }
      })
    }
    else {
      loggerError('ERROR creating  category in olc')
    }
  }

  // cocToUpdateInOlc
  for (const coc of cocToUpdateInOlc) {
    const updatedCategory = await updateOutlookCategory(client, {
      id: coc.outlookCategoryId,
      color: coc.color,
    })
    loggerError({ updatedCategory })

  }

  // cocToDeleteInOlc
  for (const coc of cocToDeleteInOlc) {
    const deletedCategory = await deleteOutlookCategory(client, coc.outlookCategoryId)
    loggerInfo({ deletedCategory })
    if (deletedCategory && !coc.toUpdateCoc) {
      cocToDelete.push({
        displayName: coc.displayName,
        outlookCategoryId: coc.outlookCategoryId,
        categoryId: coc.categoryId,
        color: coc.color,
      })
      loggerInfo('deleted')
    } else {
      loggerError('error CATEGORY delete')
    }
  }

  // filter coc to delete for customField categories
  const customFieldsFound = await models.CustomField.find({
    categoryId: { $in: cocToDelete.map(coc => coc.categoryId) }
  })

  const cocToDeleteIds = []

  for (const coc of cocToDelete) {
    const cocInCf = customFieldsFound.find(cf => String(cf.categoryId) === String(coc.categoryId))
    // loggerInfo({ cocInCf })
    if (cocInCf) {
      const createdOlc = await createOutlookCategory(client, {
        displayName: coc.displayName,
        color: coc.color
      })
      // loggerInfo({ createdOlc })

      if (createdOlc) {
        cocToUpdateBulkOps.push({
          updateOne: {
            filter: { _id: mongoose.Types.ObjectId(coc.categoryId) },
            update: {
              displayName: createdOlc.displayName,
              color: createdOlc.color,
              outlookCategoryId: createdOlc.id,
              deletedAt: null,
              updatedAt: new Date()
            }
          }
        })
      }
    } else cocToDeleteIds.push(coc.categoryId)

  }

  loggerInfo({ cocToDeleteIds })

  // cocToCreate
  await models.OutlookCategory.create(cocToCreate)
  // cocToUpdate
  await models.OutlookCategory.bulkWrite(cocToUpdateBulkOps)
  // cocToDelete
  await models.OutlookCategory.deleteMany({ _id: { $in: cocToDeleteIds } })




  // let cocToDeleteInOlc = []
  // // get categories in "coc" with id that exist in "olc" and has changes in displayName or color
  // const cocWithIdsToUpdate = colOutlookCategories.filter(coc =>
  //   coc.outlookCategoryId && outlookCategories.find(olc => olc.id === coc.outlookCategoryId &&
  //     (!isDisplayNameSame(olc.displayName, coc.displayName) || olc.color !== coc.color)))

  // // get categories in "cocWithIdsToUpdate" that is updated before categoriesSyncedAt
  // const cocToUpdate = cocWithIdsToUpdate.filter(coc => moment(coc.updatedAt).isBefore(categoriesSyncedAt))

  // // get categories in "cocWithIdsToUpdate" that is updated after categoriesSyncedAt to be updated in "olc"
  // const cocToUpdateInOlc = cocWithIdsToUpdate.filter(coc => !coc.deletedAt && !moment(coc.updatedAt).isBefore(categoriesSyncedAt))
  // cocToDeleteInOlc = [...cocToDeleteInOlc, ...cocWithIdsToUpdate.filter(coc => coc.deletedAt && !moment(coc.updatedAt).isBefore(categoriesSyncedAt))]

  // // get categories in "coc" that has no outlookCategoryId that has same name in "olc" to update in olc
  // const cocSameNameToUpdate = colOutlookCategories.filter(coc =>
  //   !coc.outlookCategoryId && !coc.deletedAt && outlookCategories.find(olc => isDisplayNameSame(olc.displayName, coc.displayName)))

  // const formattedCocSameNameToUpdate = cocSameNameToUpdate.map(coc => {
  //   const olc = outlookCategories.find(olc => isDisplayNameSame(olc.displayName, coc.displayName))
  //   return {
  //     displayName: coc.displayName,
  //     accountId: coc.accountId,
  //     origin: coc.origin,
  //     createdAt: coc.createdAt,
  //     deletedAt: coc.deletedAt,

  //     outlookCategoryId: olc.id,
  //     color: olc.color,
  //     updatedAt: new Date(),
  //   }
  // })

  // // delete category in "coc" with outlookCategoryId if not found in "olc"
  // const cocWithIdsToDelete = colOutlookCategories.filter(coc =>
  //   coc.outlookCategoryId && !outlookCategories.find(olc => olc.id === coc.outlookCategoryId))

  // const cocToCreateInOlc = colOutlookCategories.filter(coc =>
  //   !coc.deletedAt &&
  //   !coc.outlookCategoryId && !outlookCategories.find(olc => isDisplayNameSame(olc.displayName, coc.displayName)))


  // const toCreateInOc = outlookCategories.filter(oc =>
  //   !colOutlookCategories.find(coc => isDisplayNameSame(coc.displayName, oc.displayName)))

  // const toUpdateInOc = outlookCategories.filter(oc =>
  //   colOutlookCategories.find(coc => !coc.deletedAt && coc.outlookCategoryId === oc.id))

  // // const toDeleteInOc = colOutlookCategories.filter(oc =>
  // //   colOutlookCategories.find(coc => !!coc.deletedAt && isDisplayNameSame(coc.displayName, oc.displayName)))


  // const toDeleteInO = colOutlookCategories.filter(coc => !!coc.deletedAt && coc.outlookCategoryId)

  // const toCreateInO = colOutlookCategories.filter(coc => !coc.outlookCategoryId)

  // const toUpdateInO = colOutlookCategories.filter(coc =>
  //   !!coc.updatedAt &&
  //   outlookCategories.find(oc => oc.id === coc.outlookCategoryId &&
  //     (!isDisplayNameSame(coc.displayName, oc.displayName) || coc.color !== oc.color)) &&
  //   moment(coc.updatedAt).isAfter(categoriesSyncedAt)
  // )














  //   //    get categories from col_outlookCategories and push to a new list dbCategories 
  // }

  //    - dbCategories -> outlookCategories
  //    if a category from dbCategories is not in outlookCategories
  //      then create the category in outlook
  //      then save the outlookId to dbCategories and event_categories custom_fields

  ////    else
  ////      then update the category in dbCategories follow the color from outlookCategories
  ////      then save the outlookId to dbCategories and event_categories custom_fields

  //    - outlookCategories -> dbCategories
  //    if a category from outlookCategories is not in dbCategories create 
  //      then create in dbCategories
  //      then save the outlookId to dbCategories and event_categories custom_fields

  //    else if a category from outlookCategories is in dbCategories
  //      then update in dbCategories 
  //      compare updateAt and projectCategoriesAt if what color to follow
  //      if categoriesSyncedAt is null then follow outlook
  //      if updatedAt is After categoriesSyncedAt then follow db
  //      else follow outlook

  //      then save the outlookId to dbCategories and event_categories custom_fields

  //    add categories from dbCategories to col_outlookCategories collection

  //    finally update project.categoriesSyncedAt = new Date()
  // await models.Project.updateOne(
  //   { _id: projectId },
  //   { categoriesSyncedAt: new Date() }
  // )

  await models.OutlookSync.updateOne({ projectId }, { categoriesSyncedAt: new Date() })
}

module.exports = {
  syncCategories,
}
