// app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const expressLayouts = require("express-ejs-layouts");
const connectDB = require('./server/config/database');

const { isActiveRoute } = require('./server/helpers/routeHelpers');
const adminRoutes = require('./server/routes/admin');
const mainRoutes = require('./server/routes/main');

const app = express();

// ======= DATABASE CONNECTION =======
let dbConnected = false;

connectDB()
  .then(() => {
    dbConnected = true;
    console.log('✅ Database connection established');
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error.message);
    dbConnected = false;
  });

// ======= DATABASE STATUS MIDDLEWARE =======
app.use((req, res, next) => {
  req.dbConnected = dbConnected;
  next();
});

// ======= FAVICON =======
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ======= MIDDLEWARE =======
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(methodOverride('_method'));

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
  res.locals.dbConnected = req.dbConnected; // Make DB status available in views
  next();
});

// ======= ROUTES =======
app.use('/', mainRoutes);
app.use('/admin', adminRoutes);

// ======= HEALTH CHECK =======
app.get('/health', (req, res) => {
  const status = dbConnected ? 'OK' : 'Database Disconnected';
  res.status(dbConnected ? 200 : 503).json({ 
    status, 
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// ======= DATABASE STATUS PAGE =======
app.get('/db-status', (req, res) => {
  res.render('db-status', {
    title: 'Database Status',
    dbConnected: dbConnected,
    currentRoute: '/db-status'
  });
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
  
  // Handle database errors specifically
  if (err.name === 'MongoNetworkError' || err.name === 'MongooseError') {
    return res.status(503).render('500', {
      title: 'Service Unavailable',
      layout: './layouts/main',
      message: 'Database service is temporarily unavailable. Please try again later.',
      currentRoute: req.path
    });
  }

  const message = process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message;
  res.status(500).render('500', { 
    title: 'Server Error', 
    layout: './layouts/main', 
    message, 
    currentRoute: req.path 
  });
});

module.exports = app;