// Vercel invokes functions with Node's (req, res) signature,
// and an Express app is exactly that — no serverless-http wrapper.
module.exports = require('../app');
