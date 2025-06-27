const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const ejs = require('ejs');
const path = require('path');

// Show registration form
router.get('/register', async (req, res) => {
  const body = await ejs.renderFile(
    path.join(__dirname, '../views/auth/register-form.ejs'),
    { error: null, locals: { error: null } }
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
      return res.render('auth/register', { error: 'يرجى إدخال جميع الحقول' });
    }
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      return res.render('auth/register', { error: 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashed, managedParticipants: [] });
    await user.save();
    req.session.userId = user._id;
    return res.redirect('/leader/dashboard');
  } catch (err) {
    console.error('Error during registration:', err);
    return res.render('auth/register', { error: 'حدث خطأ أثناء التسجيل' });
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