const { gql } = require('apollo-server');

module.exports = gql`


  type Mutation {
    updateFirstOutlookSyncStatus: String
    syncIssueEvents(projectId: ID!, outlookSyncId: ID!): String!
    syncEvents(projectId: ID!, outlookSyncId: ID!): String!
    syncSeriesEvents(projectId: ID!, outlookSyncId: ID!): String!
    finishFirstOutlookSync(projectId: ID!, outlookSyncId: ID!): String!
  
    syncNewOutlookSeriesEvents(projectId: ID!, outlookSyncId: ID!): String!
    fetchNewOutlookSeriesEvents(projectId: ID!, outlookSyncId: ID!): String!
    updateInitOutlookSyncStatus: String
    syncCalendar(projectId: ID!): String
    prepSyncInit(projectId: ID!, outlookSyncId: ID!): String!
    initializeSync(projectId: ID!, outlookSyncId: ID!): String!
    resetAllOutlookSyncStatus: String

    deleteSyncedEvents(projectId: ID!, outlookSyncId: ID!): String! 
    deleteSyncedHiddenOutlookEvents(projectId: ID!, outlookSyncId: ID!): String! 
    deleteSyncedOutlookEvents(projectId: ID!, outlookSyncId: ID!): String! 
    deleteSyncedOutlookIssueEvents(projectId: ID!, outlookSyncId: ID!): String! 
    syncDeletedEvents(projectId: ID!, outlookSyncId: ID!): String! 
    syncEventCategories(projectId: ID!, outlookSyncId: ID!): String! 
    finishOutlookUpdateSync(projectId: ID!, outlookSyncId: ID!): String! 
    syncNewEvents(projectId: ID!, outlookSyncId: ID!): String! 
    syncNewIssueEvents(projectId: ID!, outlookSyncId: ID!): String! 
    syncOutlookEvents(projectId: ID!, outlookSyncId: ID!): String! 
    updateOutlookSyncStatus: String! 
    syncUpdatedEvents(projectId: ID!, outlookSyncId: ID!): String! 
    syncUpdatedIssueEvents(projectId: ID!, outlookSyncId: ID!): String! 
    syncUpdatedSeriesEvents(projectId: ID!, outlookSyncId: ID!): String! 
  }


`;  