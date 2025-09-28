
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        console.log('🔗 Attempting MongoDB connection...');

        let uri = process.env.MONGODB_URI;

        // Check if URI exists and is valid
        if (!uri) {
            console.error('❌ MONGODB_URI environment variable is not set');
            console.log('⚠️ Application will continue running without database');
            return;
        }

        // Fix common Render issue: Remove "MONGODB_URI=" prefix if present
        if (uri.startsWith('MONGODB_URI=')) {
            uri = uri.replace('MONGODB_URI=', '');
            console.log('🔧 Fixed malformed MONGODB_URI prefix');
        }

        // Validate URI format
        if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
            console.error('❌ Invalid MongoDB URI format. Expected to start with "mongodb://" or "mongodb+srv://"');
            console.log('💡 Current URI starts with:', uri.substring(0, 20) + '...');
            console.log('⚠️ Application will continue running without database');
            return;
        }

        // Remove problematic SSL params that may cause issues
        uri = uri.replace(/&?ssl=(true|false)/gi, '');
        uri = uri.replace(/&?tlsAllowInvalidCertificates=(true|false)/gi, '');

        // Ensure proper connection options
        const connectionOptions = {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            retryWrites: true,
            w: 'majority'
        };

        console.log('📡 Connecting to MongoDB...');
        console.log('🔒 URI:', uri.replace(/:[^:]*@/, ':****@')); // Hide password in logs

        const conn = await mongoose.connect(uri, connectionOptions);

        console.log(`✅ MongoDB Connected Successfully`);
        console.log(`🏠 Host: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);
        console.log(`📈 Ready State: ${conn.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);

        return conn;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        
        // Provide specific error messages for common issues
        if (error.name === 'MongoParseError') {
            console.log('💡 Check your MONGODB_URI format in environment variables');
        } else if (error.name === 'MongoNetworkError') {
            console.log('💡 Check your network connection and MongoDB cluster IP whitelist');
        } else if (error.name === 'MongoServerSelectionError') {
            console.log('💡 MongoDB server is not available. Check if your cluster is running');
        }
        
        console.log('⚠️ Application will continue running without database connection');
        return null;
    }
};

// MongoDB connection event handlers
mongoose.connection.on('error', err => {
    console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('🔌 MongoDB disconnected');
});

mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB connection established');
});

mongoose.connection.on('connecting', () => {
    console.log('🔄 Connecting to MongoDB...');
});

mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected');
});

mongoose.connection.on('close', () => {
    console.log('🔒 MongoDB connection closed');
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed gracefully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error closing MongoDB connection:', error.message);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed due to SIGTERM');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error closing MongoDB connection:', error.message);
        process.exit(1);
    }
});

// Helper function to check database status
const checkDBStatus = () => {
    return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
};

// Helper function to safely close connection
const closeConnection = async () => {
    if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        return true;
    }
    return false;
};

module.exports = {
    connectDB,
    checkDBStatus,
    closeConnection
};

// const mongoose = require('mongoose');

// const connectDB = async () => {
//     try {
//         console.log('🔗 Attempting MongoDB connection...');

//         let uri = process.env.MONGODB_URI;

//         // Remove SSL params that may cause issues
//         uri = uri.replace(/&?ssl=(true|false)/gi, '');
//         uri = uri.replace(/&?tlsAllowInvalidCertificates=(true|false)/gi, '');

//         console.log('📡 Connecting with URI:', uri.replace(/:[^:]*@/, ':****@'));

//         const conn = await mongoose.connect(uri, {
//             serverSelectionTimeoutMS: 10000,
//             socketTimeoutMS: 45000,
//         });

//         console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
//         console.log(`📊 Database: ${conn.connection.name}`);
//     } catch (error) {
//         console.error('❌ MongoDB connection error:', error.message);
//         console.log('⚠️ Application will continue running without database');
//     }
// };

// mongoose.connection.on('error', err => console.log('❌ MongoDB connection error:', err.message));
// mongoose.connection.on('disconnected', () => console.log('🔌 MongoDB disconnected'));
// mongoose.connection.on('connected', () => console.log('✅ MongoDB connected successfully'));

// process.on('SIGINT', async () => {
//     await mongoose.connection.close();
//     console.log('MongoDB connection closed due to app termination');
//     process.exit(0);
// });

// module.exports = connectDB;