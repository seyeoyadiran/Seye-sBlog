const serverless = require('serverless-http');
const app = require('../app');

// Export as a function that Vercel can use
const handler = serverless(app);

module.exports = (req, res) => {
  return handler(req, res);
};