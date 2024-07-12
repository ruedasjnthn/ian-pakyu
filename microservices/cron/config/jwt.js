require('dotenv').config()

const jwt = require("jsonwebtoken");

const algorithm = process.env.CRON_JWT_SECRET_TYPE;
const jwtToken = process.env.JwtToken;

const JWT_CONFIG = {
  algorithm,
  expiresIn: "500d",
};

function generateJWT({ secretUserId }) {
  const payload = {
    "https://backend.aktenplatz.de/graphql": {
      secretUserId
    },
  };
  return jwt.sign(payload, jwtToken, JWT_CONFIG);
}

module.exports = {
  generateJWT
}
