// routes/auth.js - Authentication routes with role-based redirects
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { redirectIfAuthenticated } = require('../middleware/auth');

// Show signup form (redirect if already authenticated)
router.get('/signup', redirectIfAuthenticated, authController.getSignup);

// Handle signup (redirect to appropriate dashboard after signup)
router.post('/signup', redirectIfAuthenticated, authController.postSignup);

// Show login form (redirect if already authenticated)
router.get('/login', redirectIfAuthenticated, authController.getLogin);

// Handle login (redirect to appropriate dashboard after login)
router.post('/login', redirectIfAuthenticated, authController.postLogin);

// Handle logout
router.post('/logout', authController.logout);
router.get('/logout', authController.logout); // Allow GET for logout links

module.exports = router;