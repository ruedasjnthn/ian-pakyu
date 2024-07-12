const { getOpenAIResponse } = require('../../helper/OpenAiHelper');
const { loggerInfo, loggerError } = require('../../config/logger')

//generateAiResponse
const aiResponse = async (_, { input }, __) => {
  try {
    response = await getOpenAIResponse(input)
    loggerInfo(response)
    return response;
  } catch (e) {
    loggerError({ e })
  }
};

module.exports = {
  aiResponse,
};