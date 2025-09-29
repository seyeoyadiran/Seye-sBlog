const serverless = require('serverless-http');
const app = require('../app');

// Create the serverless handler
const handler = serverless(app, {
  binary: ['image/*', 'video/*', 'application/pdf'],
  response: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
});

// Export with proper error handling
module.exports = async (req, res) => {
  // Set timeout to prevent hanging
  res.setTimeout(10000, () => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Request timeout' });
    }
  });

  try {
    return await handler(req, res);
  } catch (error) {
    console.error('Serverless handler error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
};