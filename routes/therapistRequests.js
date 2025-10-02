const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { requireAuth } = require("../middleware/auth");

// Request a therapist
router.post("/request-therapist", requireAuth, async (req, res) => {
  try {
    const patientId = req.session.user.id;
    const { therapistId } = req.body;

    if (!therapistId) {
      return res.status(400).json({
        success: false,
        error: "Therapist ID is required"
      });
    }

    // Check if patient already has a therapist
    const existingTherapistQuery = `
      SELECT therapist_id FROM therapist_patient_relationships
      WHERE patient_id = $1 AND status = 'active'
    `;
    const existingResult = await db.query(existingTherapistQuery, [patientId]);

    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "You already have an active therapist. Please end the current relationship first."
      });
    }

    // Check if therapist has reached the 5-patient limit
    const therapistPatientCountQuery = `
      SELECT COUNT(*) as patient_count
      FROM therapist_patient_relationships
      WHERE therapist_id = $1 AND status = 'active'
    `;
    const countResult = await db.query(therapistPatientCountQuery, [therapistId]);

    if (countResult.rows[0].patient_count >= 5) {
      return res.status(400).json({
        success: false,
        error: "This therapist has reached their maximum patient capacity. Please choose another therapist."
      });
    }

    // Check if request already exists
    const existingRequestQuery = `
      SELECT id FROM therapist_requests
      WHERE patient_id = $1 AND therapist_id = $2 AND status = 'pending'
    `;
    const existingRequest = await db.query(existingRequestQuery, [patientId, therapistId]);

    if (existingRequest.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "You have already sent a request to this therapist"
      });
    }

    // Create new request
    const insertQuery = `
      INSERT INTO therapist_requests (patient_id, therapist_id, status, created_at)
      VALUES ($1, $2, 'pending', CURRENT_TIMESTAMP)
      RETURNING id
    `;
    const result = await db.query(insertQuery, [patientId, therapistId]);

    if (result.rows.length > 0) {
      // Create notification for therapist
      const notificationQuery = `
        INSERT INTO notifications (user_id, type, title, message, created_at)
        VALUES ($1, 'therapist_request', 'New Patient Request',
                'A patient has requested you as their therapist. Please review and respond.',
                CURRENT_TIMESTAMP)
      `;
      await db.query(notificationQuery, [therapistId]);

      res.json({
        success: true,
        message: "Request sent successfully! The therapist will review your request."
      });
    } else {
      throw new Error("Failed to create request");
    }

  } catch (error) {
    console.error("Error creating therapist request:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send request. Please try again."
    });
  }
});

// Get therapist requests for a therapist
router.get("/my-requests", requireAuth, async (req, res) => {
  try {
    const therapistId = req.session.user.id;

    const requestsQuery = `
      SELECT
        tr.id,
        tr.patient_id,
        tr.status,
        tr.created_at,
        u.name as patient_name,
        u.email as patient_email,
        u.profile_image as patient_image
      FROM therapist_requests tr
      JOIN users u ON tr.patient_id = u.id
      WHERE tr.therapist_id = $1
      ORDER BY tr.created_at DESC
    `;

    const result = await db.query(requestsQuery, [therapistId]);
    const requests = result.rows || [];

    res.json({
      success: true,
      requests: requests
    });

  } catch (error) {
    console.error("Error fetching therapist requests:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load requests"
    });
  }
});

// Respond to therapist request (approve/reject)
router.post("/respond-request", requireAuth, async (req, res) => {
  try {
    const therapistId = req.session.user.id;
    const { requestId, action } = req.body;

    if (!requestId || !action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: "Request ID and valid action are required"
      });
    }

    // Get request details
    const requestQuery = `
      SELECT patient_id FROM therapist_requests
      WHERE id = $1 AND therapist_id = $2
    `;
    const requestResult = await db.query(requestQuery, [requestId, therapistId]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Request not found"
      });
    }

    const patientId = requestResult.rows[0].patient_id;

    if (action === 'approve') {
      // Update request status
      const updateQuery = `
        UPDATE therapist_requests
        SET status = 'approved', responded_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      await db.query(updateQuery, [requestId]);

      // Create or update therapist-patient relationship
      const relationshipQuery = `
        INSERT INTO therapist_patient_relationships (therapist_id, patient_id, status, created_at)
        VALUES ($1, $2, 'active', CURRENT_TIMESTAMP)
        ON CONFLICT (therapist_id, patient_id)
        DO UPDATE SET status = 'active', updated_at = CURRENT_TIMESTAMP
      `;
      await db.query(relationshipQuery, [therapistId, patientId]);

      // Notify patient
      const patientNotificationQuery = `
        INSERT INTO notifications (user_id, type, title, message, created_at)
        VALUES ($1, 'request_approved', 'Therapist Request Approved',
                'Your therapist request has been approved! You can now schedule appointments.',
                CURRENT_TIMESTAMP)
      `;
      await db.query(patientNotificationQuery, [patientId]);

    } else {
      // Reject request
      const updateQuery = `
        UPDATE therapist_requests
        SET status = 'rejected', responded_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      await db.query(updateQuery, [requestId]);

      // Notify patient
      const patientNotificationQuery = `
        INSERT INTO notifications (user_id, type, title, message, created_at)
        VALUES ($1, 'request_rejected', 'Therapist Request Update',
                'Your therapist request was not approved at this time. You can try requesting another therapist.',
                CURRENT_TIMESTAMP)
      `;
      await db.query(patientNotificationQuery, [patientId]);
    }

    res.json({
      success: true,
      message: `Request ${action}d successfully`
    });

  } catch (error) {
    console.error("Error responding to therapist request:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process request"
    });
  }
});

// Select therapist immediately (direct assignment)
router.post("/select-therapist", requireAuth, async (req, res) => {
  try {
    const patientId = req.session.user.id;
    const { therapistId } = req.body;

    if (!therapistId) {
      return res.status(400).json({
        success: false,
        error: "Therapist ID is required"
      });
    }

    // Check if patient already has an active therapist
    const existingTherapistQuery = `
      SELECT therapist_id FROM therapist_patient_relationships
      WHERE patient_id = $1 AND status = 'active'
    `;
    const existingResult = await db.query(existingTherapistQuery, [patientId]);

    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "You already have an active therapist. Please end the current relationship first."
      });
    }

    // Check if therapist has reached the 5-patient limit
    const therapistPatientCountQuery = `
      SELECT COUNT(*) as patient_count
      FROM therapist_patient_relationships
      WHERE therapist_id = $1 AND status = 'active'
    `;
    const countResult = await db.query(therapistPatientCountQuery, [therapistId]);

    if (countResult.rows[0].patient_count >= 5) {
      return res.status(400).json({
        success: false,
        error: "This therapist has reached their maximum patient capacity. Please choose another therapist."
      });
    }

    // Create therapist-patient relationship directly
    const relationshipQuery = `
      INSERT INTO therapist_patient_relationships (therapist_id, patient_id, status, created_at)
      VALUES ($1, $2, 'active', CURRENT_TIMESTAMP)
      ON CONFLICT (therapist_id, patient_id)
      DO UPDATE SET status = 'active', updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;
    const relationshipResult = await db.query(relationshipQuery, [therapistId, patientId]);

    if (relationshipResult.rows.length > 0) {
      // Create notification for therapist
      const notificationQuery = `
        INSERT INTO notifications (user_id, type, title, message, created_at)
        VALUES ($1, 'therapist_assigned', 'New Patient Assigned',
                'A patient has selected you as their therapist. You can now schedule appointments and start conversations.',
                CURRENT_TIMESTAMP)
      `;
      await db.query(notificationQuery, [therapistId]);

      // Create notification for patient
      const patientNotificationQuery = `
        INSERT INTO notifications (user_id, type, title, message, created_at)
        VALUES ($1, 'therapist_selected', 'Therapist Selected',
                'Your therapist has been assigned! You can now schedule appointments and start conversations.',
                CURRENT_TIMESTAMP)
      `;
      await db.query(patientNotificationQuery, [patientId]);

      res.json({
        success: true,
        message: "Therapist selected successfully! You can now schedule appointments and start conversations."
      });
    } else {
      throw new Error("Failed to create therapist-patient relationship");
    }

  } catch (error) {
    console.error("Error selecting therapist:", error);
    res.status(500).json({
      success: false,
      error: "Failed to select therapist. Please try again."
    });
  }
});

module.exports = router;