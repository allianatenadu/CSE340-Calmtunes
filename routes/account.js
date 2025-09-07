// routes/account.js - Account management for all authenticated users
const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const { requireAuth } = require('../middleware/auth');

// All account routes require authentication but work for any role
router.get('/', requireAuth, accountController.getAccount);

// Handle profile updates (with image upload)
router.post('/', requireAuth, accountController.uploadProfileImage, accountController.postAccount);

// Handle account deletion
router.delete('/delete', requireAuth, accountController.deleteAccount);
router.post('/delete', requireAuth, accountController.deleteAccount); // Allow POST for forms

module.exports = router;