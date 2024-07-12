const { gql } = require('apollo-server');

module.exports = gql`

  type CalendarEvent {
    id: ID
    projectId: ID
    title: String
    start: String
    end: String
    location: String
    notes: String
    categoryId: ID
    outlookId: String
    createdAt: String
    updatedAt: String
    deletedAt: String
  }

  type Calendar { 
    id: String!
    name: String,
    isDefaultCalendar: Boolean,
    isSelected: Boolean,
  }

  type OutlookSync { 
    id: ID!
    projectId: ID!,
    status: String!,
    syncEndAt: String,
    failedAt: String,
    isFirstSync: Boolean,
  }

  type OutlookUser {
    displayName: String
    mail: String
    accountId: String
  }

  
  type UserContact {
    id: ID,
    group_id: ID,
    projectId: ID,
    name: Name,
    contact_information: ContactInformation,
    home_address: HomeAddress,
    business_address:  BusinessAddress,
    other_address: OtherAddress,
    work: Work,
    other: Other,
    notes: Note,
    trash: Int,
    createdAt: String,
    avatarFileId: ID,
    parentFolderId: String,
    lastModifiedDateTime: String,
    fromOutlook: Boolean,
    outlookId: ID,
  }

  type Name {
    first_name: String
    last_name: String
    nick_name: String
    middle_name: String
    middle_initial: String,
    title: String
    suffix: String
    yowi_first_name: String
    yowi_last_name:String
  }

  type ContactInformation {
      email: String
      chat:String
      home_number: String
      mobile_number:String
      business_number: String
      organization_main:String
      pager: String
      other:String
      home_fax: String
      business_fax:String
      other_fax: String
      assistant_phone: String
      callback_phone: String
      radio_phone: String
      telex: String
      tty: String 
  }

  type Note {
    notes: String
  }

  type HomeAddress {
    home_address_street: String
    home_address_city: String
    home_address_state: String
    home_address_zip:  String
    home_address_country:  String
  }

  type BusinessAddress {
    business_address_street: String
    business_address_city: String
    business_address_state: String
    business_address_zip:  String
    business_address_country:  String
  }

  type OtherAddress {
    other_address_street: String
    other_address_city: String
    other_address_state: String
    other_address_zip:  String
    other_address_country:  String
  }

  type Work{ 
    company: String
    work_job_title:String
    yowi_company:  String
  }

  type Other{
    personal_webpage:String
    significant_other:  String
    birth_day: String
    Anniversary: String
  }

  type BackupProject { 
    id: ID
    projectId: ID
    isEnabled: Boolean
    backupDate: String
    updatedAt: String
  }


  type OutlookEmailSearchScore{
    type: String,
    value: String,
  }

  type OutlookEmailSearchHighlight{
    score: String,
    path: String,
    texts: [OutlookEmailSearchScore!]!
  }

  type OutlookEmailSerachResult{
    id: ID!
    projectId: String!
    webLink: String
    to: String
    from: String
    receivedDateTime: String
    subject: String
    columnKey: String
    columnPosition: Float
    highlights: [OutlookEmailSearchHighlight!]!
  }

  type OutlookTokenStatusRepsonse {
    active: Boolean
  }

  input MailRuleInput {
    targetProjectId: ID!
    targetProjectColumnKey: String
    targetEmailAddress: String!
    outlookEmailColumnEnabled: Boolean!
  }

  input MailRuleUpdateInput {
    targetProjectId: ID
    targetProjectColumnKey: String
    targetEmailAddress: String
    outlookEmailColumnEnabled: Boolean
  }

  type MailRule {
    id: ID!
    projectId: ID!
    accountId: String!
    targetProjectId: ID!
    targetEmailAddress: String!
    targetProjectColumnKey: String
    outlookEmailColumnEnabled: Boolean!
  }

  type ColumnOption {
    label: String!
    value: String!
  }
  
  type ProjectOption {
    label: String!
    value: String!
    columns: [ColumnOption]
  }

  type Mutation {
    enableOutlookSync(projectId: ID!): String!
    disableOutlookSync(projectId: ID!): String
    saveOutlookAccessToken(projectId: ID!, code: String!): String
    updateProjectCalendarId(projectId: ID!, calendarId: String!): String
    initializeSyncForCron(projectId: ID!, outlookSyncId: ID!, nextLink: String): String
    readyToInitializeSync(projectId: ID!): ID
    firstCalendarSync(projectId: ID!, outlookSyncId: ID!): ID
    syncCalendarUpdate(projectId: ID!, outlookSyncId: ID!): ID
    syncUserContacts(projectId: ID!): String
    enableOutlookContactSync(projectId: ID!): String!
    disableOutlookContactSync(projectId: ID!): String
    updateProjectContactId(projectId: ID!, contactId: String!): String
    initializeContactSyncForCron(projectId: ID!, outlookContactSyncId: ID!, nextLink: String): String
    readyToInitializeContactSync(projectId: ID!): ID
    firstContactSync(projectId: ID!, outlookContactSyncId: ID!): ID
    syncContactUpdate(projectId: ID!, outlookContactSyncId: ID!): ID
    createMailSubscription(projectId: ID!): String
    recreateMailSubscription(projectId: ID!): String
    deleteSubscription(projectId: ID!): String
    saveExistingMailsFromOutlook(projectId: ID!): String
    triggerBackupProject(projectId: ID!): String
    saveNewEmail(projectId: ID!, messageId: String!): String
    updateSubscriptionExpiration(projectId: ID!): String
    createMailRule(projectId: ID!, input: MailRuleInput!): MailRule
    createMailRules(projectId: ID!, inputs: [MailRuleInput!]!): [MailRule]
    updateMailRule(mailRuleId: ID!, input: MailRuleUpdateInput!): String
    deleteMailRule(mailRuleId: ID!): String
    createMailJobTest(projectId: ID!): String
    disconnectOutlookSync(projectId: ID!): String
  }

  type Query {
    outlookAuthUrl: String!
    outlookCalendars(projectId: ID!): [Calendar]
    outlookCalendarEvents(projectId: ID!, calendarId: ID!): [CalendarEvent]
    outlookUser(projectId: ID!): OutlookUser
    outlookSync(projectId: ID!): OutlookSync
    outlookEvent(projectId: ID!, outlookEventId: ID! ): String
    outlookContacts(projectId: ID!): [UserContact]
    outlookContactSync(projectId: ID!): OutlookSync
    getOutlookApiResults(projectId: ID!, link: String!): String
    getSubscription(projectId: ID, subscriptionId: ID): String
    listSubscriptions(projectId: ID): String
    projectBackupEnabled(projectId: ID): BackupProject
    searchOutlookEmail(query: String): [OutlookEmailSerachResult!]
    outlookTokenStatus(projectId: ID!): OutlookTokenStatusRepsonse
    getTime(timeString: String,isAllDay: Boolean,timeZone:String): String
    projectMailRules(projectId: ID!): [MailRule]
    mailRuleTargetProjOpts(projectId: ID!): [ProjectOption]
  }


`;