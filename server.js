// Load environment variables from .env file
require('dotenv').config();

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

// Configure CORS
app.use(cors({
  origin: true, // Allow requests from any origin
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

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie: {
    httpOnly: true,
    secure: false, // Set to false for local development
    sameSite: 'lax', // Helps with CSRF
    maxAge: 7 * 24 * 60 * 60 * 1000 // Session expires in 7 days
  }
}));

// Load user data for all routes
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