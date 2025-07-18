// Load environment variables from .env file
require('dotenv').config();

// Force new deployment - Firebase Admin uses environment variables
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const engine = require('ejs-mate');
const cors = require('cors');

// Log that environment variables are loaded
console.log('Environment variables loaded');
console.log('MongoDB URI configured:', process.env.MONGODB_URI ? 'Yes' : 'No');

const leaderRoutes = require('./routes/leader');
const userRoutes = require('./routes/user');
const authRoutes = require('./routes/auth');
const User = require('./models/User');

const app = express();

// Initialize Firebase Admin with environment variables
const admin = require('firebase-admin');

// Check if we have Firebase service account credentials in environment variables
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    console.log('FIREBASE_SERVICE_ACCOUNT environment variable found');
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('Service account parsed successfully, project ID:', serviceAccount.project_id);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized with environment variables');
    console.log('Available Firebase apps:', admin.apps.length);
  } catch (error) {
    console.error('Error parsing Firebase service account:', error);
    console.error('Service account content preview:', process.env.FIREBASE_SERVICE_ACCOUNT.substring(0, 100) + '...');
    console.log('Firebase Admin not initialized - some features may not work');
  }
} else {
  console.log('FIREBASE_SERVICE_ACCOUNT environment variable not found - Firebase Admin not initialized');
  console.log('Available environment variables:', Object.keys(process.env).filter(key => key.includes('FIREBASE')));
}

// Configure CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? ['https://mes-ruddy.vercel.app', 'https://mes.vercel.app'] : ['http://localhost:3001', 'http://localhost:3000'], // Allow requests from specific origins
  credentials: true, // Allow credentials (cookies) to be sent with requests
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Trust proxy (needed for secure cookies behind a proxy/load balancer)
app.set('trust proxy', 1);

// Connect to MongoDB Atlas
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mes';
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB Atlas');
}).catch(err => {
  console.error('MongoDB Atlas connection error:', err);
  console.error('Please check your connection string in the .env file');
  process.exit(1); // Exit the application if MongoDB connection fails
});

// Set EJS as the view engine
app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Body parser middleware - use Express built-in parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Set to true in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Use 'none' for production with secure: true
    maxAge: 7 * 24 * 60 * 60 * 1000 // Session expires in 7 days
  }
}));

// Load user data for all routes (BEFORE routes)
app.use(async (req, res, next) => {
  if (req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);
      res.locals.user = user;
    } catch (err) {
      console.error('Error loading user:', err);
    }
  }
  next();
});

// Mount routes
app.use('/leader', leaderRoutes);
app.use('/user', userRoutes);
app.use('/auth', authRoutes);

// Basic route for testing
app.get('/', (req, res) => {
  // Check if user is logged in
  if (req.session.userId) {
    // User is logged in, redirect to dashboard
    return res.redirect('/leader/dashboard');
  }
  // No authenticated user found, show the index page
  res.render('index');
});

// Simple test route for MongoDB Atlas connection
app.get('/test-db', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusText = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting'
  };
  
  res.json({ 
    success: true, 
    message: 'MongoDB Atlas connection test',
    dbStatus: statusText[dbStatus] || 'Unknown',
    connectionString: process.env.MONGODB_URI ? 'Configured' : 'Not configured'
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).render('404', { message: 'Page not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { message: 'Something broke!' });
});

// Start the server
const PORT = process.env.PORT || 3001; // Changed default port to 3001
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});