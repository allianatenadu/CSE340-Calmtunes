// routes/socialAuth.js - Social authentication routes
const express = require('express');
const router = express.Router();
const socialAuthController = require('../controllers/socialAuthController');
const { redirectIfAuthenticated } = require('../middleware/auth');

// Google OAuth routes
router.get('/google', redirectIfAuthenticated, socialAuthController.googleLogin);
router.get('/google/callback', redirectIfAuthenticated, socialAuthController.googleCallback);

// Spotify OAuth routes (for authentication, not music integration)
router.get('/spotify', redirectIfAuthenticated, socialAuthController.spotifyLogin);
router.get('/spotify/callback', redirectIfAuthenticated, socialAuthController.spotifyCallback);

module.exports = router;