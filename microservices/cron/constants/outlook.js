require('dotenv').config()
const { loggerInfo, loggerError } = require('../config/logger')

const isIjDev = process.env.IJ_DEV;
loggerInfo({
  isIjDev
})

const IJ_DEV_OutlookSyncStatusTypes = {
  READY_TO_INITIALIZE: 'ij_dev_ready_to_initialize',
  INITIALIZING: 'ij_dev_initializing',
  FAILED_INITIALIZING: 'ij_dev_failed_initializing',
  PENDING: 'ij_dev_pending',
  READY_TO_SYNC: 'ij_dev_ready_to_sync',
  FAILED_SYNCING: 'ij_dev_failed_syncing',
  SYNCING: 'ij_dev_syncing',
  SUCCESS: 'ij_dev_success',
  FAILED_FIRST_SYNCING: 'ij_dev_failed_first_syncing',
  FAILED_FIRST_INITIALIZING: 'ij_dev_failed_first_initializing',
}

const LOCAL_DEV_OutlookSyncStatusTypes = {
  READY_TO_INITIALIZE: 'dev_ready_to_initialize',
  INITIALIZING: 'dev_initializing',
  FAILED_INITIALIZING: 'dev_failed_initializing',
  PENDING: 'dev_pending',
  READY_TO_SYNC: 'dev_ready_to_sync',
  FAILED_SYNCING: 'dev_failed_syncing',
  SYNCING: 'dev_syncing',
  SUCCESS: 'dev_success',
  DISABLING: 'dev_disabling',
  AUTHORIZING: 'dev_authorizing',
  FAILED_FIRST_SYNCING: 'dev_failed_first_syncing',
  FAILED_FIRST_INITIALIZING: 'dev_failed_first_initializing',
}

const PROD_OutlookSyncStatusTypes = {
  READY_TO_INITIALIZE: 'ready_to_initialize',
  INITIALIZING: 'initializing',
  FAILED_INITIALIZING: 'failed_initializing',
  PENDING: 'pending',
  READY_TO_SYNC: 'ready_to_sync',
  FAILED_SYNCING: 'failed_syncing',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  DISABLING: 'disabling',
  AUTHORIZING: 'authorizing',
  FAILED_FIRST_SYNCING: 'failed_first_syncing',
  FAILED_FIRST_INITIALIZING: 'failed_first_initializing',
}

const OutlookSyncStatusTypes = isIjDev
  ? IJ_DEV_OutlookSyncStatusTypes
  : PROD_OutlookSyncStatusTypes

const OutlookSyncStatusTypesArray = [
  OutlookSyncStatusTypes.READY_TO_INITIALIZE,
  OutlookSyncStatusTypes.INITIALIZING,
  OutlookSyncStatusTypes.FAILED_INITIALIZING,
  OutlookSyncStatusTypes.READY_TO_SYNC,
  OutlookSyncStatusTypes.FAILED_SYNCING,
  OutlookSyncStatusTypes.SYNCING,
  OutlookSyncStatusTypes.PENDING,
  OutlookSyncStatusTypes.SUCCESS,
]

module.exports = {
  OutlookSyncStatusTypes,
  OutlookSyncStatusTypesArray
}
