const mongoose = require("mongoose");
const { Schema } = mongoose;

const outlookAccountaSchema = new Schema({
  mail: { type: String, required: true },
  accountId: { type: String, required: true }
})


const userSchema = new Schema({
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
  outlookEmails: {
    type: [outlookAccountaSchema],
    default: []
  }
});

const User = mongoose.model("User", userSchema, "col_Users");

module.exports = { User };
