const mongoose = require("mongoose");
const { Schema } = mongoose;

const recipient = new Schema({
  emailAddress: {
    name: String,
    address: String
  }
})

const body = new Schema({
  content: String,
  contentType: String
})

const outlookMailSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  sourceProjectId: {
    type: Schema.Types.ObjectId,
  },
  bccRecipients: [recipient],
  ccRecipients: [recipient],
  from: recipient,
  sender: recipient,
  replyTo: [recipient],
  toRecipients: [recipient],
  body: body,
  bodyPreview: {
    type: String
  },
  categories: {
    type: [String]
  },
  hasAttachments: {
    type: Boolean
  },
  importance: {
    type: String
  },
  isRead: {
    type: Boolean
  },
  subject: {
    type: String
  },
  webLink: {
    type: String
  },
  createdAt: {
    type: Date
  },
  updatedAt: {
    type: Date
  },
  deletedAt: {
    type: Date,
  },
  parentFolderId: {
    type: String,
  },
  lastModifiedDateTime: {
    type: Date
  },
  receivedDateTime: {
    type: Date
  },
  sentDateTime: {
    type: Date
  },
  fromOutlook: {
    type: Boolean,
  },
  outlookId: {
    type: String,
  },
  columnKey: {
    type: String
  },
  columnPosition: {
    type: Number,
  },
  changeKey: {
    type: String,
  },
});

const OutlookMail = mongoose.model("OutlookMail", outlookMailSchema, "col_OutlookMails");

module.exports = { OutlookMail };