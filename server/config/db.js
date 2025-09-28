const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        console.log('🔗 Attempting MongoDB connection...');

        let uri = process.env.MONGODB_URI;

        // Check if URI exists and is valid
        if (!uri) {
            console.error('❌ MONGODB_URI environment variable is not set');
            console.log('⚠️ Application will continue running without database');
            return null;
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
            return null;
        }

        // Connection options specifically for Render + MongoDB Atlas
        const connectionOptions = {
            serverSelectionTimeoutMS: 30000, // Increased timeout
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            retryWrites: true,
            w: 'majority',
            
            // SSL/TLS options for MongoDB Atlas
            ssl: true,
            tls: true,
            tlsAllowInvalidCertificates: false,
            tlsAllowInvalidHostnames: false,
            
            // MongoDB driver options
            useNewUrlParser: true,
            useUnifiedTopology: true,
            
            // Connection pool options
            maxIdleTimeMS: 30000,
            minPoolSize: 0,
            
            // Buffer commands to avoid timeouts during connection
            bufferCommands: true,
            bufferMaxEntries: -1,
            bufferTimeoutMS: 5000
        };

        console.log('📡 Connecting to MongoDB...');
        console.log('🔒 URI:', uri.replace(/:[^:]*@/, ':****@')); // Hide password in logs

        // Add event listeners before connecting
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
        } else if (error.name === 'MongoNetworkError' || error.name === 'MongoServerSelectionError') {
            console.log('💡 Network/SSL issue. Possible solutions:');
            console.log('   1. Check MongoDB Atlas IP whitelist (allow 0.0.0.0/0)');
            console.log('   2. Try adding these parameters to your connection string:');
            console.log('      &ssl=true&tlsAllowInvalidCertificates=true');
            console.log('   3. Check if your MongoDB Atlas cluster is running');
        } else if (error.message.includes('SSL') || error.message.includes('TLS')) {
            console.log('💡 SSL/TLS connection issue. Try adding to your MONGODB_URI:');
            console.log('   ?ssl=true&tlsAllowInvalidCertificates=true');
        }
        
        console.log('⚠️ Application will continue running without database connection');
        return null;
    }
};

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

const checkDBStatus = () => {
    return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
};

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