require("dotenv").config();
const mongoose = require("mongoose");
const { loggerInfo, loggerError } = require('./logger')

const DATABASE_URL = process.env.DATABASE_URL;

const connectDb = () => {
  return mongoose.connect(DATABASE_URL, { useUnifiedTopology: true, useNewUrlParser: true }, err => {
    if (err) {
      loggerInfo("Connection to Database failed.");
    }
    else{
      loggerInfo("Database connection successful.");
    }
  });
};

const db = mongoose.connection;

db.on("error", console.error.bind(console, "MongoDB connection error"));

module.exports = connectDb;
