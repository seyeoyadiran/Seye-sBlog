const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('❌ MONGODB_URI not set in environment variables');
}

// Cache the connection for serverless environments
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    console.log('✅ Using cached MongoDB connection');
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      bufferCommands: false, // Disable mongoose buffering
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000, // Reduced from 30s for serverless
      socketTimeoutMS: 30000,
      // Remove bufferMaxEntries - it's deprecated
    };

    console.log('📡 Creating new MongoDB connection...');
    console.log('🔒 URI:', MONGODB_URI.replace(/:[^:]*@/, ':****@')); // Hide password

    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongoose) => {
        console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
        console.log(`📊 Database: ${mongoose.connection.name}`);
        return mongoose;
      })
      .catch((error) => {
        console.error('❌ MongoDB connection error:', error.message);
        cached.promise = null; // Reset on error
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

// Don't use process.exit in serverless - let Vercel handle it
process.on('SIGINT', async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log('🛑 MongoDB connection closed');
  }
});

module.exports = connectDB;