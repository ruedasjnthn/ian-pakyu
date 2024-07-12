require("dotenv").config();

const { gql } = require('apollo-server');

module.exports = gql`

  type Account @key(fields: "id") {
    id: ID!
    name: String 
  }

  type CurrentUser {
    id: String
    name: String
    email: String
    avatarUrl: String
    avatarFileId: String
    languageCode: String
    avatarColor: String
    changeEmail: String
    countAllOpenTasks: Boolean
    disableAutoRefresh: Boolean
    weeklyHour:Float
    workingDays:Float,
    descriptionTemplate:String,
    countOnlyWeeklyHours:Boolean
  }

  type DeletionUserResponse {
    status: Boolean,
    message: String
  }

  type UserLoginBlock {
    loginBlocked: Boolean
    isAccountLocked: Boolean
    latestFailTime: String
  }



  input AcceptInviteProps {
    token: String!
    projectId: String!
    languageCode: String!
  }

  input AuthCreateCustomFieldInput {
    type: String!
    label: String!
  }

  type TimeTrackerDetail {
    timeTrackerStatus: String
    timeTrackerStatusUpdateAt: String
  }

  extend type Query {
    currentUser: CurrentUser!
    verifyToken(token: String!): Boolean
    userInfo(id: ID!): CurrentUser
    userLoginBlocked(email: String!): UserLoginBlock
    getTimeTrackerStatus : TimeTrackerDetail
  }

  extend type Mutation {
    mailLogin(email: String!, token: String, acceptInvite: AcceptInviteProps): String
    confirmLoginToken(email: String!, token: String!, forOneYear: Boolean): String
    createUser(
      email: String!, 
      languageCode: String, 
      acceptInvite: AcceptInviteProps,
      customFields: [AuthCreateCustomFieldInput]
    ): String
    updateUser(
      name: String, 
      avatarFileId: String,
      avatarColor: String,
      languageCode: String,
      countAllOpenTasks: Boolean,
      disableAutoRefresh: Boolean,
      weeklyHour:Float,
      workingDays:Float,
      descriptionTemplate:String,
      countOnlyWeeklyHours:Boolean
    ): String
    deleteUser(email: String!): DeletionUserResponse
    updateUserEmail(email: String!, newEmail:String!): String
    confirmNewEmail(email: String!, token: String!): String
    updateTimeTrackerStatus(timeTrackerStatus: String!): String
  }

`;
