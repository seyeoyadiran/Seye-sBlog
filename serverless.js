// serverless.js
const app = require('./app'); // your current app.js
const serverless = require('serverless-http');

// Catch favicon requests to prevent crashes
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Export the serverless handler
module.exports = serverless(app);
