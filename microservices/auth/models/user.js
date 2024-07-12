const mongoose = require("mongoose");
const { Schema } = mongoose;

const changeEmailSchema = new Schema({
  newEmail: {
    type: String
  },
  token: {
    type: String
  },
  updatedAt: {
    type: Date
  },
  retryCount: {
    type: Number
  },
});

const otpFailSchema = new Schema({
  failedAt: {
    type: Date
  },
  userIp: {
    type: String
  }
});

const loginDetailSchema = new Schema({
  userAgent: {
    type: String
  },
  userIp: {
    type: String
  },
  retryCount: {
    type: Number
  },
})

const userSchema = new Schema({
  ClientId: {
    type: mongoose.Types.ObjectId
  },
  Hash: {
    type: String
  },
  Email: {
    type: String
  },
  Password: {
    type: String
  },
  Roles: {
    type: Array
  },
  Permissions: {
    type: Array
  },
  Token: {
    type: String
  },
  name: {
    type: String
  },
  updatedAt: {
    type: Date
  },
  createdAt: {
    type: Date
  },
  avatarUrl: {
    type: String
  },
  avatarColor: {
    type: String
  },
  avatarFileId: {
    type: String
  },
  languageCode: {
    type: String
  },
  deviceAccount: {
    type: Boolean
  },
  jwtToken: {
    type: String
  },
  lastSignedIn: {
    type: Date
  },
  changeEmail: {
    type: changeEmailSchema
  },
  otpFails: {
    type: [otpFailSchema],
    default: []
  },
  countAllOpenTasks: {
    type: Boolean,
    default: false,
  },
  disableAutoRefresh: {
    type: Boolean,
    default: false,
  },
  weeklyHour: {
    type: Number,
    default: 40
  },
  workingDays: {
    type: Number,
    default: 5
  },
  lastSentLoginTokenAt: {
    type: Date,
  },
  timeTrackerStatus: {
    type: String
  },
  timeTrackerStatusUpdateAt: {
    type: Date
  },
  descriptionTemplate:{
    type:String
  },
  countOnlyWeeklyHours:{
    type:Boolean
  },
  loginDetail: {
    type: loginDetailSchema
  },



});

const User = mongoose.model("User", userSchema, "col_Users");

module.exports = { User };
