/* api/index.js
   Vercel runs every file in the api folder as a serverless function.
   We simply hand it the Express app. */

module.exports = require('../app');
