

const AutomationStatusTypes = {
  CONFIG_CHANGE: 'config_change',
  SUCCESS: 'success',
  NO_ACTIONS_PERFORMED: 'no_actions_preformed',
  IN_PROGRESS: 'in_progress',
  LOOP: 'loop',
  THROLLED: 'throttled',
  SOME_ERRORS: 'some_errors',
  ABSORBED: 'aborted',
  FAILURE: 'failure',
}

const AutomationStatusTypesArray = [
  AutomationStatusTypes.CONFIG_CHANGE,
  AutomationStatusTypes.SUCCESS,
  AutomationStatusTypes.NO_ACTIONS_PERFORMED,
  AutomationStatusTypes.IN_PROGRESS,
  AutomationStatusTypes.LOOP,
  AutomationStatusTypes.THROLLED,
  AutomationStatusTypes.SOME_ERRORS,
  AutomationStatusTypes.ABSORBED,
  AutomationStatusTypes.FAILURE,
]

const AutomationActionTypes = {
  SEND_EMAIL: 'send_email',
  HIGHLIGHT_ISSUE: 'highlight_issue',
  ASSIGN_ISSUE: 'assign_issue',
}

const AutomationActionTypesArray = [
  AutomationActionTypes.SEND_EMAIL,
  AutomationActionTypes.HIGHLIGHT_ISSUE,
  AutomationActionTypes.ASSIGN_ISSUE,
];

const AutomationJobStatusTypes = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
}

const AutomationJobStatusArray = [
  AutomationJobStatusTypes.PENDING,
  AutomationJobStatusTypes.SUCCESS,
  AutomationJobStatusTypes.FAILED,
]

module.exports = {
  AutomationStatusTypes,
  AutomationStatusTypesArray,
  AutomationActionTypes,
  AutomationActionTypesArray,
  AutomationJobStatusTypes,
  AutomationJobStatusArray
}
