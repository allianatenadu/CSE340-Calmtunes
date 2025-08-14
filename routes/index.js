const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const authController = require('../controllers/authController');
const dashboardController = require('../controllers/dashboardController');
const accountController = require('../controllers/accountController');
const moodTrackerController = require('../controllers/moodTrackerController');

// Import music routes
const musicRoutes = require('./music');

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.flash('error', 'Please log in to access this page');
    res.redirect('/login');
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
router.post('/account', requireAuth, accountController.postAccount);

// Private routes (require authentication)
router.get('/dashboard', requireAuth, dashboardController.getDashboard);
router.get('/music', requireAuth, dashboardController.getMusic);
router.get('/drawing', requireAuth, dashboardController.getDrawing);
router.get('/panic', requireAuth, dashboardController.getPanic);
router.get('/therapists', requireAuth, dashboardController.getTherapists);
router.get('/account', requireAuth, accountController.getAccount);

// Music API routes - mounted under /music
router.use('/music', musicRoutes);

module.exports = router;