// api/index.js
const serverless = require('serverless-http');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const app = require('../app');

const mongoURI = process.env.MONGODB_URI;

// Cached Mongo connection for serverless
let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoURI, {
      tls: true,
      serverSelectionTimeoutMS: 30000,
    }).then(m => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// ======= Initialize session middleware once per cold start =======
let sessionInitialized = false;
async function initSession() {
  if (sessionInitialized) return;
  if (!mongoURI) return;

  await connectDB();
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

  sessionInitialized = true;
}

// ======= Serverless handler =======
module.exports.handler = serverless(async (req, res) => {
  await initSession(); // ensures session store & DB connection
  return app(req, res);
});
