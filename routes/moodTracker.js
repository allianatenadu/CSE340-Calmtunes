
// routes/moodTracker.js
const express = require('express');
const router = express.Router();
const moodTrackerController = require('../controllers/moodTrackerController');

// Middleware to require authentication
function requireAuth(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.flash('error', 'Please log in to access this page');
    res.redirect('/login');
  }
}

// Routes
router.get('/mood-tracker', requireAuth, moodTrackerController.getMoodTracker);
router.post('/mood-tracker', requireAuth, moodTrackerController.postMoodEntry);


module.exports = router;
