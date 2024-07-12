const { gql } = require('apollo-server');

module.exports = gql`

  type OutlookMail {
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
    updatedAt: String
  }

  type OutlookMailResponse {
    outlookMails: [OutlookMail]
    isMailDisplayedInBoard: Boolean
  }

  type ProjectOutlookMailResponse {
    totalCount: Int
    hasMore: Boolean
    nextOffset: Int
    outlookMails: [OutlookMail]
  }

  type FolderOption {
    value: String
    label: String
  }

  type Mutation {
    changeProjectDefaultOutlookMailsColumn(
      projectId: ID!,
      columnKey: String!
    ): String
    removeProjectDefaultOutlookMailsColumn(projectId: ID!): String
    changeOutlookMailColumn(
      outlookMailId: ID!, 
      columnKey: String!, 
      columnPosition: Float
    ): String
    removeOutlookMailColumn(outlookMailId: ID!): String
    executeMailJob(mailJobId: ID!): String
    moveMessageToAnotherProject(
      projectId: ID!,
      sourceFolderId: String!,
      targetProjectId: ID!,
    ): String
    refreshMailSubscription(projectId: ID!): String
  }

  type Query {
    columnOutlookMails(
      projectId: ID!, 
      columnKey: String!,
      offset: Int,
      limit: Int
    ): OutlookMailResponse!,
    outlookFoldersOpts(projectId: ID!): [FolderOption],
    projectOutlookMails(
      projectId: ID!, 
      offset: Int,
      limit: Int
    ): ProjectOutlookMailResponse!,
  }


`;