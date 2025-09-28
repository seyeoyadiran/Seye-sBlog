require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// Database
const connectDB = require('./server/config/db');
connectDB();

// Helpers
const { isActiveRoute } = require('./server/helpers/routeHelpers');

// Routes
const adminRoutes = require('./server/routes/admin');
const mainRoutes = require('./server/routes/main');

const app = express();
const expressLayouts = require("express-ejs-layouts");

// ======= MIDDLEWARE =======
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(methodOverride('_method'));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'keyboard-cat',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI
    }),
    cookie: { maxAge: 3600000 } // 1 hour
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Templating Engine
app.use(expressLayouts);
app.set('layout', './layouts/main');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Make helpers available in all views
app.locals.isActiveRoute = isActiveRoute;
app.use((req, res, next) => {
    res.locals.currentRoute = req.path; // ✅ FIX for "currentRoute is not defined"
    next();
});

// ======= ROUTES =======
app.use('/', mainRoutes);
app.use('/admin', adminRoutes); // ✅ All admin routes under /admin prefix

// ======= 404 HANDLER =======
app.use((req, res) => {
    res.status(404).render('404', {
        title: 'Page Not Found',
        layout: './layouts/main'
    });
});

// ======= START SERVER =======
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
