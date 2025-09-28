require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');

const { isActiveRoute } = require('./server/helpers/routeHelpers');
const adminRoutes = require('./server/routes/admin');
const mainRoutes = require('./server/routes/main');

const app = express();
const expressLayouts = require("express-ejs-layouts");

// ======= DATABASE CONNECTION =======
let mongoURI = process.env.MONGODB_URI;

// Fix Render’s "MONGODB_URI=MONGODB_URI=" double assignment issue
if (mongoURI && mongoURI.startsWith('MONGODB_URI=')) {
  mongoURI = mongoURI.replace('MONGODB_URI=', '');
  console.log('🔧 Fixed malformed MONGODB_URI');
}

let isDBConnected = false;

async function connectDB() {
  if (!mongoURI) {
    console.error('❌ No MongoDB URI provided');
    return;
  }

  try {
    console.log("📡 Connecting to MongoDB...");
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 30000,
      tls: true, // force TLS (Atlas requirement)
    });
    isDBConnected = true;
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    isDBConnected = false;
  }
}

// Connect on startup
connectDB();

// ======= MIDDLEWARE =======
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(methodOverride('_method'));

// ======= SESSION CONFIGURATION =======
let store;
if (mongoURI) {
  store = MongoStore.create({
    mongoUrl: mongoURI,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60,
    autoRemove: 'native',
  });
  console.log('✅ MongoDB session store configured');
} else {
  console.log('⚠️  Using memory store for sessions');
  store = new session.MemoryStore();
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: store,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
}));

// ======= SECURITY MIDDLEWARE =======
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ======= STATIC FILES =======
app.use(express.static(path.join(__dirname, 'public')));

// ======= TEMPLATING ENGINE =======
app.use(expressLayouts);
app.set('layout', './layouts/main');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ======= GLOBAL VIEW VARIABLES =======
app.locals.isActiveRoute = isActiveRoute;
app.use((req, res, next) => {
  res.locals.currentRoute = req.path;
  res.locals.isProduction = process.env.NODE_ENV === 'production';
  res.locals.currentYear = new Date().getFullYear();
  res.locals.dbConnected = isDBConnected;
  next();
});

// ======= ROUTES =======
app.use('/', mainRoutes);
app.use('/admin', adminRoutes);

// ======= HEALTH CHECK ENDPOINT =======
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: {
      configured: !!mongoURI,
      connected: isDBConnected
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

// ======= SIMPLE ROOT ENDPOINT =======
app.get('/', (req, res) => {
  res.redirect('/posts');
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
  const message = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong!' 
    : err.message;
  res.status(500).render('500', {
    title: 'Server Error',
    layout: './layouts/main',
    message: message,
    currentRoute: req.path
  });
});

// ======= START SERVER =======
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`
🚀 Server running on port ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📊 Database: ${mongoURI ? (isDBConnected ? 'Connected' : 'Connecting...') : 'Not configured'}
🕒 Started at: ${new Date().toLocaleString()}
  `);
});

module.exports = app;
