// server.js
require('dotenv').config();
const app = require('./app');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const PORT = process.env.PORT || 5000;
const mongoURI = process.env.MONGODB_URI;

async function startServer() {
  if (!mongoURI) {
    console.error("❌ No MONGODB_URI found in environment variables");
    process.exit(1);
  }

  await mongoose.connect(mongoURI, {
    tls: true,
    serverSelectionTimeoutMS: 30000,
  });

  const store = MongoStore.create({ mongoUrl: mongoURI, ttl: 14 * 24 * 60 * 60 });
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'fallback-secret-key',
      resave: false,
      saveUninitialized: false,
      store,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
      },
    })
  );

  app.listen(PORT, () => {
    console.log(`🚀 Server running locally at http://localhost:${PORT}`);
  });
}

startServer();
