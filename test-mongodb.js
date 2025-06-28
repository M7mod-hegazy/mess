// Simple script to test MongoDB Atlas connection
require('dotenv').config();
const mongoose = require('mongoose');

// Get MongoDB URI from environment variables
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mes';

// Connect to MongoDB
console.log('Attempting to connect to MongoDB Atlas...');
console.log(`Connection string: ${MONGO_URI.replace(/\/\/.+@/, '//***@')}`);

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Successfully connected to MongoDB Atlas!');
  console.log('Connection state:', mongoose.connection.readyState);
  
  // Get database information
  console.log('Database name:', mongoose.connection.name);
  
  // Close the connection after testing
  mongoose.connection.close().then(() => {
    console.log('Connection closed successfully.');
    process.exit(0);
  });
}).catch(err => {
  console.error('MongoDB Atlas connection error:', err);
  process.exit(1);
});