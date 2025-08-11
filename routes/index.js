const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const authController = require('../controllers/authController');
const dashboardController = require('../controllers/dashboardController');

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

// Private routes (require authentication)
router.get('/dashboard', requireAuth, dashboardController.getDashboard);
router.get('/music', requireAuth, dashboardController.getMusic);
router.get('/drawing', requireAuth, dashboardController.getDrawing);
router.get('/panic', requireAuth, dashboardController.getPanic);
router.get('/mood-tracker', requireAuth, dashboardController.getMoodTracker);
router.post('/mood-tracker', requireAuth, dashboardController.postMoodEntry);
router.get('/therapists', requireAuth, dashboardController.getTherapists);

module.exports = router;