const express = require('express');
const router = express.Router();
const User = require('../models/User');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const ejs = require('ejs');
const path = require('path');

// Show registration form
router.get('/register', async (req, res) => {
  const body = await ejs.renderFile(
    path.join(__dirname, '../views/auth/register-form.ejs'),
    { error: null } // Pass error as null initially
  );
  res.render('layout', {
    title: 'التسجيل - نظام إدارة الوجبات',
    head: '<link rel="stylesheet" href="/css/responsive.css">',
    body
  });
});

// Handle registration
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    if (!username || !email || !password) {
      const body = await ejs.renderFile(path.join(__dirname, '../views/auth/register-form.ejs'), { error: 'يرجى إدخال جميع الحقول' });
      return res.render('layout', { title: 'التسجيل - نظام إدارة الوجبات', head: '<link rel="stylesheet" href="/css/responsive.css">', body });
    }
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      const body = await ejs.renderFile(path.join(__dirname, '../views/auth/register-form.ejs'), { error: 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل' });
      return res.render('layout', { title: 'التسجيل - نظام إدارة الوجبات', head: '<link rel="stylesheet" href="/css/responsive.css">', body });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashed, managedParticipants: [] });
    await user.save();
    req.session.userId = user._id;
    req.session.save(() => {
      return res.redirect('/leader/dashboard');
    });
  } catch (err) {
    console.error('Error during registration:', err);
    const body = await ejs.renderFile(path.join(__dirname, '../views/auth/register-form.ejs'), { error: 'حدث خطأ أثناء التسجيل' });
    return res.render('layout', { title: 'التسجيل - نظام إدارة الوجبات', head: '<link rel="stylesheet" href="/css/responsive.css">', body });
  }
});

// Show login form
router.get('/login', async (req, res) => {
  const body = await ejs.renderFile(
    path.join(__dirname, '../views/auth/login-form.ejs'),
    { error: null, locals: { error: null } }
  );
  res.render('layout', {
    title: 'تسجيل الدخول - نظام إدارة الوجبات',
    head: '<link rel="stylesheet" href="/css/responsive.css">',
    body
  });
});

// Handle login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Allow login with either username or email
    console.log('Attempting login for:', username);
    const user = await User.findOne({ $or: [{ username: username }, { email: username }] });
    console.log('User found:', user ? user.username : 'None');
    if (!user) {
      const body = await ejs.renderFile(path.join(__dirname, '../views/auth/login-form.ejs'), { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      return res.render('layout', { title: 'تسجيل الدخول - نظام إدارة الوجبات', head: '<link rel="stylesheet" href="/css/responsive.css">', body });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      const body = await ejs.renderFile(path.join(__dirname, '../views/auth/login-form.ejs'), { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      return res.render('layout', { title: 'تسجيل الدخول - نظام إدارة الوجبات', head: '<link rel="stylesheet" href="/css/responsive.css">', body });
    }
    req.session.userId = user._id;
    // Render set-localstorage page to set localStorage and redirect
    return res.render('auth/set-localstorage', { user });
  } catch (err) {
    console.error('Error during login:', err);
    const body = await ejs.renderFile(path.join(__dirname, '../views/auth/login-form.ejs'), { error: 'حدث خطأ أثناء تسجيل الدخول' });
    res.render('layout', { title: 'تسجيل الدخول - نظام إدارة الوجبات', head: '<link rel="stylesheet" href="/css/responsive.css">', body });
  }
});

router.post('/authenticate-google', async (req, res) => {
  let idToken = req.body.idToken;
  if (!idToken && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    idToken = req.headers.authorization.split(' ')[1];
  }
  if (!idToken) {
    console.log('No ID token provided in request');
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
    return res.status(401).send('No ID token provided!');
  }

  console.log('Received ID token length:', idToken.length);
  console.log('ID token starts with:', idToken.substring(0, 20) + '...');

  try {
    // Check if Firebase Admin is initialized
    if (!admin.apps.length) {
      console.log('Firebase Admin not initialized - skipping token verification');
      console.log('Available apps:', admin.apps);
      return res.status(500).send('Firebase Admin not configured. Please check environment variables.');
    }

    console.log('Firebase Admin is initialized, attempting to verify token...');
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log('Successfully verified ID token! User:', decodedToken);

    // Extract user data from the request body
    const { displayName, email, photoURL, isRegistration } = req.body;

    // Find existing user by email
    let user = await User.findOne({ email: decodedToken.email });
    
    if (!user) {
      // Create new user if they don't exist
      const username = displayName || decodedToken.email.split('@')[0]; // Use display name or email prefix as username
      
      user = new User({
        username: username,
        email: decodedToken.email,
        displayName: displayName || '',
        photoURL: photoURL || '',
        googleId: decodedToken.uid,
        managedParticipants: [],
        role: 'leader', // Ensure Google users are leaders
        // Set a default password for Google users (they won't use it)
        password: await bcrypt.hash(Math.random().toString(36), 10)
      });
      
      await user.save();
      console.log('Created new user from Google auth:', user.username);
    } else {
      // Update existing user with Google info if needed
      let updated = false;
      if (!user.googleId) {
        user.googleId = decodedToken.uid;
        updated = true;
      }
      if (displayName && !user.displayName) {
        user.displayName = displayName;
        updated = true;
      }
      if (photoURL && !user.photoURL) {
        user.photoURL = photoURL;
        updated = true;
      }
      if (!user.role) {
        user.role = 'leader';
        updated = true;
      }
      if (updated) {
        await user.save();
        console.log('Updated existing user with Google info:', user.username);
      }
    }

    // Set session
    req.session.userId = user._id;
    console.log('Google auth - Setting session userId:', user._id);
    console.log('Google auth - Session before save:', req.session);
    req.session.save(() => {
      console.log('Google auth - Session saved successfully');
      // Redirect to dashboard after successful login
      res.redirect('/leader/dashboard');
    });
  } catch (error) {
    console.error('Error verifying ID token:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return res.status(401).send('Unauthorized: Invalid ID token.');
  }
});

// Show Firebase test page
router.get('/test-firebase', (req, res) => {
  res.render('auth/test-firebase');
});

// Test Firebase Admin configuration
router.get('/test-firebase-admin', async (req, res) => {
  try {
    const admin = require('firebase-admin');
    
    const testResult = {
      adminInitialized: admin.apps.length > 0,
      appsCount: admin.apps.length,
      environmentVariables: {
        hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
        serviceAccountLength: process.env.FIREBASE_SERVICE_ACCOUNT ? process.env.FIREBASE_SERVICE_ACCOUNT.length : 0
      }
    };
    
    if (admin.apps.length > 0) {
      try {
        // Try to get the default app
        const app = admin.app();
        testResult.defaultApp = {
          name: app.name,
          options: app.options
        };
      } catch (error) {
        testResult.defaultAppError = error.message;
      }
    }
    
    res.json(testResult);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Handle logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

// Handle Firebase logout
router.post('/logout-firebase', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// User profile page
router.get('/profile', async (req, res) => {
  try {
    let user = null;
    if (req.session.userId) {
      user = await User.findById(req.session.userId);
    }
    
    // If no session userId, try to find the user from recent periods (for Google users)
    if (!user) {
      console.log('Profile - No session userId, checking for Google user...');
      const Period = require('../models/Period');
      const allPeriods = await Period.find().sort({ createdAt: -1 }).limit(1);
      if (allPeriods.length > 0) {
        const recentPeriod = allPeriods[0];
        user = await User.findById(recentPeriod.leaderId);
        console.log('Profile - Found user from recent period:', user ? user._id : 'No user');
      }
    }
    
    if (!user) {
      console.log('Profile - No user found, redirecting to login');
      return res.redirect('/auth/login');
    }
    
    res.render('auth/profile', { user, error: null, success: null });
  } catch (error) {
    console.error('Error loading profile page:', error);
    res.redirect('/auth/login');
  }
});

// Update user profile
router.post('/profile', async (req, res) => {
  try {
    let user = null;
    if (req.session.userId) {
      user = await User.findById(req.session.userId);
    }
    
    // If no session userId, try to find the user from recent periods (for Google users)
    if (!user) {
      console.log('Profile update - No session userId, checking for Google user...');
      const Period = require('../models/Period');
      const allPeriods = await Period.find().sort({ createdAt: -1 }).limit(1);
      if (allPeriods.length > 0) {
        const recentPeriod = allPeriods[0];
        user = await User.findById(recentPeriod.leaderId);
        console.log('Profile update - Found user from recent period:', user ? user._id : 'No user');
      }
    }
    
    if (!user) {
      return res.redirect('/auth/login');
    }
    
    const { username, email, displayName, currentPassword, newPassword, confirmPassword } = req.body;
    
    // Check if username or email already exists (excluding current user)
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
      _id: { $ne: user._id }
    });
    
    if (existingUser) {
      return res.render('auth/profile', { 
        user, 
        error: 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل', 
        success: null 
      });
    }
    
    // Update basic info
    user.username = username;
    user.email = email;
    user.displayName = displayName;
    
    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        return res.render('auth/profile', { 
          user, 
          error: 'يجب إدخال كلمة المرور الحالية لتغيير كلمة المرور', 
          success: null 
        });
      }
      
      // For Google users, they might not have a password set
      if (user.googleId && !user.password) {
        return res.render('auth/profile', { 
          user, 
          error: 'لا يمكن تغيير كلمة المرور لحساب Google', 
          success: null 
        });
      }
      
      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.render('auth/profile', { 
          user, 
          error: 'كلمة المرور الحالية غير صحيحة', 
          success: null 
        });
      }
      
      if (newPassword !== confirmPassword) {
        return res.render('auth/profile', { 
          user, 
          error: 'كلمة المرور الجديدة وتأكيد كلمة المرور غير متطابقين', 
          success: null 
        });
      }
      
      if (newPassword.length < 6) {
        return res.render('auth/profile', { 
          user, 
          error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', 
          success: null 
        });
      }
      
      user.password = await bcrypt.hash(newPassword, 10);
    }
    
    await user.save();
    
    res.render('auth/profile', { 
      user, 
      error: null, 
      success: 'تم تحديث الملف الشخصي بنجاح' 
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.render('auth/profile', { 
      user, 
      error: 'حدث خطأ أثناء تحديث الملف الشخصي', 
      success: null 
    });
  }
});

module.exports = router;