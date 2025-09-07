// routes/index.js - Fixed version with better error handling
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth, requirePatient, requireAuthGeneral } = require('../middleware/auth');

// Home page - redirect authenticated users to their appropriate dashboard
router.get('/', (req, res) => {
  try {
    // If user is logged in, redirect to appropriate dashboard
    if (req.session && req.session.user) {
      switch (req.session.user.role) {
        case 'admin':
          return res.redirect('/admin');
        case 'therapist':
          return res.redirect('/therapist');
        case 'patient':
        default:
          return res.redirect('/dashboard');
      }
    }
    
    // Show home page for non-authenticated users
    res.render('pages/home', { 
      title: 'CalmTunes - Mental Health Support',
      user: null 
    });
  } catch (error) {
    console.error('Home route error:', error);
    res.render('pages/home', { 
      title: 'CalmTunes - Mental Health Support',
      user: null 
    });
  }
});

// Patient Dashboard - Only accessible to patients
// Let's make this more flexible to handle different user types gracefully
router.get('/dashboard', requireAuth, (req, res, next) => {
  // If user is not a patient, redirect them to their appropriate dashboard
  if (req.session.user.role === 'admin') {
    return res.redirect('/admin');
  }
  if (req.session.user.role === 'therapist') {
    return res.redirect('/therapist');
  }
  // Continue to dashboard controller for patients
  next();
}, dashboardController.getDashboard);

// General therapy features - Available to all authenticated users
router.get('/panic', requireAuth, dashboardController.getPanic);

// Public pages
router.get('/about', (req, res) => {
  try {
    res.render('pages/about', { 
      title: 'About CalmTunes',
      user: req.session.user || null 
    });
  } catch (error) {
    console.error('About page error:', error);
    res.render('pages/about', { 
      title: 'About CalmTunes',
      user: null 
    });
  }
});

router.get('/contact', (req, res) => {
  try {
    res.render('pages/contact', { 
      title: 'Contact Us - CalmTunes',
      user: req.session.user || null 
    });
  } catch (error) {
    console.error('Contact page error:', error);
    res.render('pages/contact', { 
      title: 'Contact Us - CalmTunes',
      user: null 
    });
  }
});

module.exports = router;