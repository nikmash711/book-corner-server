'use strict'; 

require('dotenv').config(); //this is what we used to set up the env variable for JWT_SECRET

module.exports = {
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:3000',

  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/jewishbookcorner',

  TEST_MONGODB_URI: process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/jewishbookcorner',

  PORT: process.env.PORT || 8080,

  JWT_SECRET: process.env.JWT_SECRET, //this doesnt have a fallback so it has to get the value assigned in the env variable

  JWT_EXPIRY: process.env.JWT_EXPIRY || '7d'
};
