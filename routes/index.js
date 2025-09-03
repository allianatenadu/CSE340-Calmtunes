const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const authController = require('../controllers/authController');
const dashboardController = require('../controllers/dashboardController');
const accountController = require('../controllers/accountController');
const musicController = require('../controllers/musicController'); // ✅ Add this import

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  console.log("🔐 Auth check - Session:", !!req.session);
  console.log("🔐 Auth check - User:", req.session?.user ? 'exists' : 'missing');
  
  if (req.session && req.session.user && req.session.user.id) {
    console.log("✅ Auth check passed for user:", req.session.user.name);
    next();
  } else {
    console.log("❌ Auth check failed - redirecting to login");
    req.flash('error', 'Please log in to access this page');
    res.redirect('/login');
  }
}

// Middleware to check if user is a therapist
function requireTherapist(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'therapist') {
    console.log("✅ Therapist access granted for:", req.session.user.name);
    next();
  } else {
    console.log("❌ Therapist access denied for:", req.session.user?.name || 'anonymous');
    req.flash('error', 'Access denied. Therapist account required.');
    res.redirect('/dashboard');
  }
}

// Middleware to check if user is a patient
function requirePatient(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'patient') {
    console.log("✅ Patient access granted for:", req.session.user.name);
    next();
  } else {
    console.log("❌ Patient access denied for:", req.session.user?.name || 'anonymous');
    req.flash('error', 'Access denied. Patient account required.');
    res.redirect('/dashboard');
  }
}

// Public routes
router.get('/', homeController.getHome);
router.get('/about', homeController.getAbout);
router.get('/login', authController.getLogin);
router.get('/signup', authController.getSignup);
router.post('/login', authController.postLogin);
router.post('/signup', authController.postSignup);
router.get('/logout', authController.getLogout);

// Shared authenticated routes (both patients and therapists)
router.get('/dashboard', requireAuth, dashboardController.getDashboard);

// Account management routes
router.get('/account', requireAuth, accountController.getAccount);
router.post('/account', requireAuth, accountController.postAccount);
router.get('/account/delete', requireAuth, accountController.deleteAccount);

// Patient-specific routes
router.get('/panic', requireAuth, requirePatient, dashboardController.getPanic);
router.get('/therapists', requireAuth, requirePatient, dashboardController.getTherapists);

// Therapist-specific routes
router.get('/patients', requireAuth, requireTherapist, dashboardController.getPatients);

// Alternative route that redirects based on user role
router.get('/find-help', requireAuth, (req, res) => {
  if (req.session.user.role === 'therapist') {
    res.redirect('/patients');
  } else {
    res.redirect('/therapists');
  }
});

// Debug route (remove in production)
router.get('/debug-session', requireAuth, (req, res) => {
  res.json({
    session: {
      user: req.session.user,
      sessionID: req.sessionID,
      role: req.session.user?.role
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;