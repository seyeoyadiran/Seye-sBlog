require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const expressLayouts = require("express-ejs-layouts");

const { isActiveRoute } = require('./server/helpers/routeHelpers');
const adminRoutes = require('./server/routes/admin');
const mainRoutes = require('./server/routes/main');

const app = express();

// ======= FAVICON HANDLER =======
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ======= MIDDLEWARE =======
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(methodOverride('_method'));

// ======= SESSION (MongoDB store) =======
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  console.warn("⚠️ No MONGODB_URI found in environment variables. Sessions may not persist.");
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: mongoURI
      ? MongoStore.create({
          mongoUrl: mongoURI,
          ttl: 14 * 24 * 60 * 60, // 14 days
          autoRemove: 'native',
        })
      : undefined, // fallback to in-memory if no DB
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    },
  })
);

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
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
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

module.exports = app;
