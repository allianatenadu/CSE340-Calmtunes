const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { requireAuth } = require("../middleware/auth");

// Notifications page
router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    // Get notifications
    const notificationsQuery = `
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const notificationsResult = await db.query(notificationsQuery, [userId]);
    const notifications = notificationsResult.rows || [];

    // Get therapist requests (for therapists only)
    let therapistRequests = [];
    if (userRole === 'therapist') {
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
      const requestsResult = await db.query(requestsQuery, [userId]);
      therapistRequests = requestsResult.rows || [];
    }

    res.render("pages/notifications", {
      title: "Notifications - CalmTunes",
      user: req.session.user,
      notifications: notifications,
      therapistRequests: therapistRequests,
      layout: "layouts/minimal", // Use minimal layout (no navbar, footer, or sidebar)
    });

  } catch (error) {
    console.error("Error loading notifications page:", error);
    req.flash("error", "Failed to load notifications");
    res.redirect("/dashboard");
  }
});

// API endpoint to get notifications
router.get("/api/notifications", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const query = `
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `;
    const result = await db.query(query, [userId]);

    res.json({
      success: true,
      notifications: result.rows
    });

  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notifications"
    });
  }
});

// API endpoint to mark notification as read
router.post("/api/notifications/:id/mark-read", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const notificationId = req.params.id;

    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );

    res.json({ success: true });

  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark notification as read"
    });
  }
});

// API endpoint to get therapist requests
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

// API endpoint to respond to therapist requests
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

module.exports = router;