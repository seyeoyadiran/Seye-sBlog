const serverless = require('serverless-http');
const app = require('../app'); // import the pure express app

module.exports = serverless(app);
