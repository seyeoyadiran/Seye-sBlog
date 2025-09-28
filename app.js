require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const session = require('express-session');

// Database - Import with proper error handling
let connectDB, checkDBStatus;
try {
    const dbModule = require('./server/config/db');
    connectDB = dbModule.connectDB;
    checkDBStatus = dbModule.checkDBStatus;
} catch (error) {
    console.log('⚠️  Database module not available, running without DB');
    connectDB = async () => { 
        console.log('💡 Database connection skipped'); 
        return null; 
    };
    checkDBStatus = () => 'disconnected';
}

// Helpers
const { isActiveRoute } = require('./server/helpers/routeHelpers');

// Routes
const adminRoutes = require('./server/routes/admin');
const mainRoutes = require('./server/routes/main');

const app = express();
const expressLayouts = require("express-ejs-layouts");

// ======= FIX MONGODB URI =======
let mongoURI = process.env.MONGODB_URI;

// Remove "MONGODB_URI=" prefix if it exists (common Render issue)
if (mongoURI && mongoURI.startsWith('MONGODB_URI=')) {
    mongoURI = mongoURI.replace('MONGODB_URI=', '');
    console.log('🔧 Fixed malformed MONGODB_URI');
}

// Validate MongoDB URI format and connect
let isDBConnected = false;
if (mongoURI && (mongoURI.startsWith('mongodb://') || mongoURI.startsWith('mongodb+srv://'))) {
    console.log('🔗 MongoDB URI format is valid');
    
    // Connect to database only if URI is valid (with delay to avoid race conditions)
    setTimeout(async () => {
        try {
            const conn = await connectDB();
            isDBConnected = conn !== null;
        } catch (error) {
            console.log('⚠️  Database connection failed, running without DB');
            isDBConnected = false;
        }
    }, 100);
} else {
    console.error('❌ Invalid or missing MongoDB URI. Application will run without database.');
    if (mongoURI) {
        console.log('💡 MONGODB_URI should start with mongodb:// or mongodb+srv://');
        console.log('💡 Current URI starts with:', mongoURI.substring(0, 30) + '...');
    }
}

// ======= MIDDLEWARE =======
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(methodOverride('_method'));

// ======= SESSION CONFIGURATION WITH ERROR HANDLING =======
let store;

// Try to use MongoDB store if available, otherwise fallback to memory store
try {
    // Dynamically require connect-mongo only if we might use it
    let MongoStore;
    if (mongoURI && (mongoURI.startsWith('mongodb://') || mongoURI.startsWith('mongodb+srv://'))) {
        MongoStore = require('connect-mongo');
        
        store = MongoStore.create({
            mongoUrl: mongoURI,
            collectionName: 'sessions',
            ttl: 14 * 24 * 60 * 60, // 14 days expiration
            autoRemove: 'native' // automatically remove expired sessions
        });
        console.log('✅ MongoDB session store configured');
    } else {
        throw new Error('No valid MongoDB URI');
    }
} catch (error) {
    console.log('⚠️  Using memory store for sessions:', error.message);
    store = new session.MemoryStore();
}

app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false, // Changed to false for GDPR compliance
    store: store,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: process.env.NODE_ENV === 'production', // HTTPS in production
        httpOnly: true // Prevents client-side JS from reading the cookie
    }
}));

// ======= SECURITY MIDDLEWARE =======
// Basic security headers
app.use((req, res, next) => {
    // Remove server signature
    res.removeHeader('X-Powered-By');
    
    // Security headers
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

// Make current route available in all views
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
    const dbStatus = checkDBStatus ? checkDBStatus() : 'unknown';
    
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: {
            configured: !!mongoURI,
            connected: dbStatus === 'connected',
            status: dbStatus
        },
        environment: process.env.NODE_ENV || 'development'
    });
});

// ======= SIMPLE ROOT ENDPOINT FOR TESTING =======
app.get('/', (req, res) => {
    res.redirect('/posts'); // Redirect to posts page or your main page
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
    
    // Don't leak error details in production
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

// Small delay to ensure any async operations are ready
setTimeout(() => {
    app.listen(PORT, HOST, () => {
        console.log(`
🚀 Server running on port ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📊 Database: ${mongoURI ? (isDBConnected ? 'Connected' : 'Connection failed') : 'Not configured'}
🕒 Started at: ${new Date().toLocaleString()}
        `);
        
        // Log important environment info
        console.log('🔧 Environment check:');
        console.log(`   - PORT: ${PORT}`);
        console.log(`   - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
        console.log(`   - MONGODB_URI: ${mongoURI ? 'set' : 'not set'}`);
        if (mongoURI) {
            console.log(`   - URI starts with: ${mongoURI.substring(0, 20)}...`);
        }
    });
}, 100);

// Handle uncaught exceptions more gracefully
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error.message);
    // Don't exit immediately in production, try to keep running
    if (process.env.NODE_ENV === 'production') {
        console.log('🔄 Continuing in production despite error...');
    } else {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise);
    console.error('💥 Reason:', reason);
    // In production, log but don't crash
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
});

module.exports = app;