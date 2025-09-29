const serverless = require('serverless-http');
const { app, connectDB } = require('../app');

const mongoURI = process.env.MONGODB_URI;

app.use(async (req, res, next) => {
  try {
    await connectDB(mongoURI);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = serverless(app);
