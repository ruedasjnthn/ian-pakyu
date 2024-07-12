require('dotenv').config();
const jwt = require('jsonwebtoken');

const cfgSignatureSecretExpiresIn = process.env.CFG_SIGNATURE_SECRET_EXPIRES_IN;
const cfgSignatureSecret = process.env.CFG_SIGNATURE_SECRET;
const cfgSignatureSecretAlgorithmRequest =
  process.env.CFG_SIGNATURE_SECRET_ALGORITHM_REQUEST;

const generateToken = async (_, input, { models, user }) => {
  try {
    const { key } = input?.params?.document;

    const file = await models.File.findById(key);

    const { oOfficeKey, projectId } = file;

    const projectMember = await models.Project.findOne({
      _id: projectId,
      users: {
        $elemMatch: { userId: { $eq: user.sub } },
      },
    });

    if (projectMember) {
      let newKey;

      if (oOfficeKey) {
        newKey = `${key}_${oOfficeKey}`;
      } else {
        const randomKey = Math.random().toString(36).substring(2, 10);
        newKey = `${key}_${randomKey}`;
        await models.File.updateOne({ _id: key }, { oOfficeKey: randomKey });
      }

      input.params.document.key = newKey;

      const options = {
        algorithm: cfgSignatureSecretAlgorithmRequest,
        expiresIn: cfgSignatureSecretExpiresIn,
      };

      const token = jwt.sign(input.params, cfgSignatureSecret, options);
      return {
        token,
        key: newKey,
      };
    }
  } catch (e) {
    return e;
  }
};

module.exports = {
  generateToken,
};
