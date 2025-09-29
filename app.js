require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const session = require('express-session');
const mongoose = require('mongoose');
const expressLayouts = require("express-ejs-layouts");
const serverless = require('serverless-http');

const { isActiveRoute } = require('./server/helpers/routeHelpers');
const adminRoutes = require('./server/routes/admin');
const mainRoutes = require('./server/routes/main');

const app = express();

// ======= FAVICON HANDLER =======
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ======= SERVERLESS-SAFE MONGODB =======
let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null };

async function connectDB(uri) {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      tls: true,
      serverSelectionTimeoutMS: 30000,
    }).then(m => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// ======= MIDDLEWARE =======
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(methodOverride('_method'));

// ======= SESSION =======
const mongoURI = process.env.MONGODB_URI;
let store = new session.MemoryStore(); // fallback for serverless

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
}));

// ======= SECURITY HEADERS =======
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ======= STATIC FILES =======
app.use(express.static(path.join(__dirname, 'public')));

// ======= EJS LAYOUTS =======
app.use(expressLayouts);
app.set('layout', './layouts/main');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ======= GLOBAL VARIABLES =======
app.locals.isActiveRoute = isActiveRoute;
app.use((req, res, next) => {
  res.locals.currentRoute = req.path;
  res.locals.isProduction = process.env.NODE_ENV === 'production';
  res.locals.currentYear = new Date().getFullYear();
  next();
});

// ======= ROUTES =======
app.use('/', mainRoutes);
app.use('/admin', adminRoutes);

// ======= HEALTH CHECK =======
app.get('/health', async (req, res) => {
  try {
    await connectDB(mongoURI);
    res.status(200).json({ status: 'OK', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// ======= 404 HANDLER =======
app.use((req, res) => {
  res.status(404).render('404', { 
    title: 'Page Not Found', 
    layout: './layouts/main', 
    currentRoute: req.path 
  });
});

// ======= ERROR HANDLER =======
app.use((err, req, res, next) => {
  console.error('🚨 Server Error:', err.message);
  const message = process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message;
  res.status(500).render('500', { 
    title: 'Server Error', 
    layout: './layouts/main', 
    message, 
    currentRoute: req.path 
  });
});

// ======= SERVERLESS EXPORT =======
module.exports.handler = serverless(app);

// ======= LOCAL DEV SERVER =======
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  if (!mongoURI) {
    console.error("❌ No MONGODB_URI found in environment variables");
    process.exit(1);
  }

  connectDB(mongoURI)
    .then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 Server running locally at http://localhost:${PORT}`);
      });
    })
    .catch(err => {
      console.error("❌ Failed to connect to MongoDB:", err.message);
      process.exit(1);
    });
}
