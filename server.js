require('dotenv').config();
const app = require('./app');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 5000;
const mongoURI = process.env.MONGODB_URI;

async function startServer() {
  try {
    if (!mongoURI) throw new Error("❌ No MONGODB_URI found in environment variables");

    await mongoose.connect(mongoURI, {
      tls: true,
      serverSelectionTimeoutMS: 30000,
    });

    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
}

startServer();
