// routes/support.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// Start support conversation with admin
router.post('/start', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const { message } = req.body;

    // Don't allow admins to use this endpoint
    if (userRole === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admins should use the admin panel'
      });
    }

    // Find any admin user
    const adminQuery = `SELECT id FROM users WHERE role = 'admin' LIMIT 1`;
    const adminResult = await db.query(adminQuery);

    if (!adminResult.rows || adminResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No admin available. Please try again later.'
      });
    }

    const adminId = adminResult.rows[0].id;

    // Check for existing admin conversation
    // Store with user as patient_id, admin as therapist_id
    const existingQuery = `
      SELECT id FROM conversations
      WHERE patient_id = $1 AND therapist_id = $2
      AND conversation_type = 'admin'
      AND (status IS NULL OR status = 'active')
    `;

    const existingResult = await db.query(existingQuery, [userId, adminId]);

    let conversationId;

    if (existingResult.rows && existingResult.rows.length > 0) {
      conversationId = existingResult.rows[0].id;
      console.log('Found existing support conversation:', conversationId);
    } else {
      // Create new admin support conversation
      const createQuery = `
        INSERT INTO conversations (
          patient_id, therapist_id, conversation_type, status,
          created_at, updated_at
        ) VALUES ($1, $2, 'admin', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `;

      const created = await db.query(createQuery, [userId, adminId]);
      conversationId = created.rows[0].id;
      console.log('Created new support conversation:', conversationId);
    }

    // Send initial message if provided
    if (message && message.trim()) {
      const messageQuery = `
        INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at)
        VALUES ($1, $2, $3, 'text', CURRENT_TIMESTAMP)
        RETURNING id
      `;

      await db.query(messageQuery, [conversationId, userId, message.trim()]);
    }

    // Notify admin
    try {
      const notifyQuery = `
        INSERT INTO notifications (user_id, type, title, message, data, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `;
      await db.query(notifyQuery, [
        adminId,
        'admin_support',
        `${userRole === 'therapist' ? 'Therapist' : 'Patient'} Support Request`,
        `${req.session.user.name} has started a support conversation`,
        JSON.stringify({ conversationId })
      ]);
    } catch (notifyError) {
      console.log('Notification creation failed (non-critical):', notifyError.message);
    }

    res.json({
      success: true,
      conversationId: conversationId,
      message: 'Support conversation started'
    });

  } catch (error) {
    console.error('Error starting support conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start support conversation'
    });
  }
});

module.exports = router;