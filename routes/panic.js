const express = require("express");
const router = express.Router();
const panicController = require("../controllers/panicController");
const { requireAuth, requirePatient } = require("../middleware/auth");

// Only authenticated patients can access Panic Support
router.get("/", requireAuth, requirePatient, panicController.getPanicPage);

// Save panic session
router.post("/save-session", requireAuth, requirePatient, panicController.savePanicSession);

// Serve panic session audio files securely
router.get('/audio/:filename', requireAuth, panicController.serveAudioFile);

// Share panic session with therapist
router.post('/share-with-therapist', requireAuth, requirePatient, async (req, res) => {
  try {
    const patientId = req.session.user.id;
    const sessionData = req.body;

    // Get patient's assigned therapist
    const therapistQuery = `
      SELECT therapist_id FROM therapist_patient_relationships
      WHERE patient_id = $1 AND status = 'active'
      LIMIT 1
    `;
    const therapistResult = await db.query(therapistQuery, [patientId]);

    if (therapistResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No assigned therapist found'
      });
    }

    const therapistId = therapistResult.rows[0].therapist_id;

    // Create notification for therapist about the shared session
    const notificationQuery = `
      INSERT INTO notifications (user_id, type, title, message, data, created_at)
      VALUES ($1, 'panic_session_shared', 'Patient Shared Panic Session',
              'A patient has shared a panic session with you for review.',
              $2, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    const notificationData = {
      sessionId: sessionData.sessionId,
      patientId: patientId,
      sharedAt: new Date().toISOString(),
      sessionDetails: sessionData
    };

    await db.query(notificationQuery, [therapistId, JSON.stringify(notificationData)]);

    res.json({
      success: true,
      message: 'Session shared with therapist successfully'
    });

  } catch (error) {
    console.error('Error sharing panic session with therapist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to share session with therapist'
    });
  }
});

module.exports = router;