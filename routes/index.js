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

// Book a session page - Available to authenticated patients
router.get('/book-session', requireAuth, (req, res) => {
  // Redirect non-patients to their appropriate dashboard
  if (req.session.user.role === 'admin') {
    return res.redirect('/admin');
  }
  if (req.session.user.role === 'therapist') {
    return res.redirect('/therapist');
  }

  // Show booking page for patients with patient layout
  res.render('pages/book-session', {
    title: 'Book a Session - CalmTunes',
    user: req.session.user,
    currentPage: 'book-session',
    layout: 'layouts/patient'
  });
});

// My Sessions page - Available to authenticated patients
router.get('/my-session', requireAuth, (req, res) => {
  // Redirect non-patients to their appropriate dashboard
  if (req.session.user.role === 'admin') {
    return res.redirect('/admin');
  }
  if (req.session.user.role === 'therapist') {
    return res.redirect('/therapist');
  }

  // Show my sessions page for patients with patient layout
  res.render('pages/my-session', {
    title: 'My Sessions - CalmTunes',
    user: req.session.user,
    currentPage: 'my-session',
    layout: 'layouts/patient'
  });
});

// Therapist Profile page - Available to authenticated patients
router.get('/therapist/profile/:therapistId', requireAuth, (req, res) => {
  // Redirect non-patients to their appropriate dashboard
  if (req.session.user.role === 'admin') {
    return res.redirect('/admin');
  }
  if (req.session.user.role === 'therapist') {
    return res.redirect('/therapist');
  }

  // Show therapist profile page for patients with patient layout
  res.render('pages/therapist/profile', {
    title: 'Therapist Profile - CalmTunes',
    user: req.session.user,
    currentPage: 'therapist-profile',
    layout: 'layouts/patient'
  });
});

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

// API route for getting user sessions (for my-session page)
router.get('/api/user/sessions', requireAuth, async (req, res) => {
  try {
    const appointmentController = require('../controllers/appointmentController');
    await appointmentController.getUserAppointments(req, res);
  } catch (error) {
    console.error('Error in user sessions API:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions'
    });
  }
});

// API route for cancelling sessions
router.post('/api/sessions/:sessionId/cancel', requireAuth, async (req, res) => {
  try {
    const appointmentController = require('../controllers/appointmentController');
    // Modify the request to match appointment controller expectations
    req.params.appointmentId = req.params.sessionId;
    await appointmentController.cancelAppointment(req, res);
  } catch (error) {
    console.error('Error cancelling session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel session'
    });
  }
});

// API route for getting therapist profile
router.get('/therapist/api/profile/:therapistId', requireAuth, async (req, res) => {
  try {
    const therapistController = require('../controllers/therapistController');
    // Use the existing getTherapistById method or create a new one
    if (therapistController.getTherapistProfile) {
      await therapistController.getTherapistProfile(req, res);
    } else {
      // Fallback to getTherapistById if getTherapistProfile doesn't exist
      req.params.id = req.params.therapistId;
      await therapistController.getTherapistById(req, res);
    }
  } catch (error) {
    console.error('Error fetching therapist profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch therapist profile'
    });
  }
});

// API route for rating therapist
router.post('/api/therapist/:therapistId/rate', requireAuth, async (req, res) => {
  try {
    const therapistController = require('../controllers/therapistController');
    if (therapistController.rateTherapist) {
      await therapistController.rateTherapist(req, res);
    } else {
      res.status(501).json({
        success: false,
        error: 'Rating functionality not yet implemented'
      });
    }
  } catch (error) {
    console.error('Error rating therapist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit rating'
    });
  }
});

// API route for getting therapist reviews and ratings
router.get('/api/therapist/:therapistId/reviews', requireAuth, async (req, res) => {
  try {
    const therapistController = require('../controllers/therapistController');
    if (therapistController.getTherapistReviews) {
      await therapistController.getTherapistReviews(req, res);
    } else {
      res.status(501).json({
        success: false,
        error: 'Reviews functionality not yet implemented'
      });
    }
  } catch (error) {
    console.error('Error fetching therapist reviews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reviews'
    });
  }
});

// Fallback route for /chat requests - redirect to proper chat route
router.get('/chat', requireAuth, (req, res) => {
  // Redirect to the proper chat route
  const queryString = req.url.split('?')[1] || '';
  res.redirect(`/appointments/chat${queryString ? '?' + queryString : ''}`);
});

module.exports = router;