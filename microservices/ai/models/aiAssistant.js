const mongoose = require("mongoose");
const { Schema } = mongoose;

const actionSchema = new Schema({
  name: {
    type: String
  },
  subline: {
    type: String
  }
})

const subMenuItemSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  gptRequest: {
    type: String,
    required: true
  },
  action: {
    type: actionSchema,
    required: true 
  }
})

const aiAssistantSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  gptRequest: {
    type: String
  },
  subMenuItems: {
    type: [subMenuItemSchema]
  },
  action: {
    type: actionSchema
  },
  
});

const AiAssistant = mongoose.model("AiAssistant", aiAssistantSchema, "col_AiAssistant");

module.exports = { AiAssistant };
