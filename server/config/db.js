const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        console.log('🔗 Attempting MongoDB connection...');

        let uri = process.env.MONGODB_URI;

        // Remove SSL params that may cause issues
        uri = uri.replace(/&?ssl=(true|false)/gi, '');
        uri = uri.replace(/&?tlsAllowInvalidCertificates=(true|false)/gi, '');

        console.log('📡 Connecting with URI:', uri.replace(/:[^:]*@/, ':****@'));

        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.log('⚠️ Application will continue running without database');
    }
};

mongoose.connection.on('error', err => console.log('❌ MongoDB connection error:', err.message));
mongoose.connection.on('disconnected', () => console.log('🔌 MongoDB disconnected'));
mongoose.connection.on('connected', () => console.log('✅ MongoDB connected successfully'));

process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed due to app termination');
    process.exit(0);
});

module.exports = connectDB;


// const mongoose = require('mongoose');

// const connectDB = async () => {
//     try {
//         const conn = await mongoose.connect(process.env.MONGODB_URI, {
//             useNewUrlParser: true,
//             useUnifiedTopology: true,
//             // Add these options for better connection handling
//             serverSelectionTimeoutMS: 5000,
//             socketTimeoutMS: 45000,
//         });
        
//         console.log(`MongoDB Connected: ${conn.connection.host}`);
//     } catch (error) {
//         console.error('MongoDB connection error:', error);
//         // Don't exit the process, let the app continue
//         console.log('App will continue running without database connection');
//     }
// };

// // Handle connection events
// mongoose.connection.on('error', err => {
//     console.log('MongoDB connection error:', err);
// });

// mongoose.connection.on('disconnected', () => {
//     console.log('MongoDB disconnected');
// });

// mongoose.connection.on('connected', () => {
//     console.log('MongoDB connected');
// });

// module.exports = connectDB;