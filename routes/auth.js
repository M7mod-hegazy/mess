const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Show registration form
router.get('/register', (req, res) => {
  res.render('auth/register');
});

// Handle registration
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) {
      return res.render('auth/register', { error: 'يرجى إدخال جميع الحقول' });
    }
    const existing = await User.findOne({ username });
    if (existing) {
      return res.render('auth/register', { error: 'اسم المستخدم مستخدم بالفعل' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashed, managedParticipants: [] });
    await user.save();
    req.session.userId = user._id;
    res.redirect('/leader/dashboard');
  } catch (err) {
    console.error('Error during registration:', err);
    res.render('auth/register', { error: 'حدث خطأ أثناء التسجيل' });
  }
});

// Show login form
router.get('/login', (req, res) => {
  res.render('auth/login');
});

// Handle login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.render('auth/login', { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('auth/login', { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    req.session.userId = user._id;
    res.redirect('/leader/dashboard');
  } catch (err) {
    console.error('Error during login:', err);
    res.render('auth/login', { error: 'حدث خطأ أثناء تسجيل الدخول' });
  }
});

// Handle logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

module.exports = router;