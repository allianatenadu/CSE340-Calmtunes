// routes/therapist.js - Updated with profile routes, chat, and schedule
const express = require("express");
const router = express.Router();
const db = require("../config/database");
const therapistController = require("../controllers/therapistController");
const chatController = require("../controllers/chatController");
const appointmentController = require("../controllers/appointmentController");
const {
  requireAuth,
  requireTherapist,
  requirePotentialTherapist,
} = require("../middleware/auth");

/**
 * Helper function to get profile image URL
 * @param {Object} user - User object with profile_image property
 * @returns {string|null} Profile image URL or null if not available
 */
function getProfileImageUrl(user) {
  if (!user || !user.profile_image) return null;
  return user.profile_image.startsWith("/")
    ? user.profile_image
    : `/uploads/profiles/${user.profile_image}`;
}

// Therapist dashboard - main route (for approved therapists)
router.get(
  "/",
  requireAuth,
  requireTherapist,
  therapistController.getDashboard
);

// Application routes - allow any authenticated user to apply
router.get(
  "/apply",
  requireAuth,
  requirePotentialTherapist,
  therapistController.getApplicationForm
);
router.post(
  "/apply",
  requireAuth,
  requirePotentialTherapist,
  therapistController.submitApplication
);

// Patient management (for approved therapists)
router.get(
  "/patients",
  requireAuth,
  requireTherapist,
  therapistController.getPatients
);

// Schedule management (for approved therapists)
router.get(
  "/schedule",
  requireAuth,
  requireTherapist,
  therapistController.getSchedule
);

// Chat routes (for approved therapists) - Use same interface as patients
router.get("/chat", requireAuth, requireTherapist, (req, res) => {
  res.render("pages/conversation", {
    title: "Chat",
    user: req.session.user,
    conversationId: null,
    showAdminChat: false,
    currentPage: "chat", // Add currentPage for sidebar navigation
    layout: "layouts/therapist", // Use therapist layout but same chat interface
  });
});

// API routes for chat functionality - THERAPIST CONVERSATIONS
router.get(
  "/api/conversations",
  requireAuth,
  requireTherapist,
  chatController.getConversations
);
router.get(
  "/api/conversations/:conversationId/messages",
  requireAuth,
  requireTherapist,
  chatController.getMessages
);
router.post(
  "/api/conversations/:conversationId/messages",
  requireAuth,
  requireTherapist,
  chatController.sendMessage
);
router.post(
  "/api/conversations/start",
  requireAuth,
  requireTherapist,
  chatController.startConversation
);

// API routes for video calls - TODO: Implement video calling functionality
// router.post("/api/video-call/start", requireAuth, requireTherapist, chatController.startVideoCall);
// router.post("/api/video-call/:videoCallId/join", requireAuth, requireTherapist, chatController.joinVideoCall);
// router.post("/api/video-call/:videoCallId/end", requireAuth, requireTherapist, chatController.endVideoCall);

// Appointment management API routes
router.get(
  "/api/appointments",
  requireAuth,
  requireTherapist,
  appointmentController.getUserAppointments
);
router.post(
  "/api/appointments/create",
  requireAuth,
  requireTherapist,
  appointmentController.createAppointment
);
router.post(
  "/api/appointments/:appointmentId/confirm",
  requireAuth,
  requireTherapist,
  appointmentController.confirmAppointment
);
router.post(
  "/api/appointments/:appointmentId/reject",
  requireAuth,
  requireTherapist,
  appointmentController.rejectAppointment
);
router.post(
  "/api/appointments/:appointmentId/cancel",
  requireAuth,
  requireTherapist,
  appointmentController.cancelAppointment
);

// Enhanced Patient Profile page
router.get(
  "/patients/:patientId/profile",
  requireAuth,
  requireTherapist,
  (req, res) => {
    const patientId = req.params.patientId;
    const therapistId = req.session.user.id;

    // Validate patientId parameter
    if (!patientId || isNaN(parseInt(patientId))) {
      return res.status(400).json({
        success: false,
        error: "Invalid patient ID",
      });
    }

    res.render("pages/therapist/patient-therapist", {
      title: "Patient Profile",
      subtitle: "Comprehensive patient overview",
      user: req.session.user,
      patientId: patientId,
      profileImageUrl: getProfileImageUrl(req.session.user),
      currentPage: "patients",
      layout: "layouts/therapist",
    });
  }
);

// Patient Info page (for the /info endpoint)
router.get(
  "/patients/:patientId/info",
  requireAuth,
  requireTherapist,
  therapistController.getPatientInfo
);

// API route to get patients for therapist
router.get(
  "/api/patients",
  requireAuth,
  requireTherapist,
  therapistController.getPatientsAPI
);

// API routes for availability
router.get(
  "/api/:therapistId/availability",
  therapistController.getAvailability
);

// API route for getting approved therapists (for booking page)
router.get(
  "/api/approved",
  therapistController.getApprovedTherapistsAPI
);

// API route for schedule statistics
router.get(
  "/schedule-stats",
  requireAuth,
  requireTherapist,
  async (req, res) => {
    try {
      const therapistId = req.session.user.id;

      // Get pending requests count
      const pendingQuery = `
        SELECT COUNT(*) as count
        FROM appointments
        WHERE therapist_id = $1 AND status = 'pending'
      `;
      const pendingResult = await db.query(pendingQuery, [therapistId]);
      const pendingRequests = parseInt(pendingResult.rows[0].count) || 0;

      // Get today's sessions count
      const today = new Date().toISOString().split('T')[0];
      const todayQuery = `
        SELECT COUNT(*) as count
        FROM appointments
        WHERE therapist_id = $1 AND appointment_date = $2 AND status = 'confirmed'
      `;
      const todayResult = await db.query(todayQuery, [therapistId, today]);
      const todaySessions = parseInt(todayResult.rows[0].count) || 0;

      // Get this week's sessions count
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + (startOfWeek.getDay() === 0 ? -6 : 1));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const weekQuery = `
        SELECT COUNT(*) as count
        FROM appointments
        WHERE therapist_id = $1
        AND appointment_date >= $2
        AND appointment_date <= $3
        AND status = 'confirmed'
      `;
      const weekResult = await db.query(weekQuery, [
        therapistId,
        startOfWeek.toISOString().split('T')[0],
        endOfWeek.toISOString().split('T')[0]
      ]);
      const weekSessions = parseInt(weekResult.rows[0].count) || 0;

      // Get total upcoming sessions count
      const upcomingQuery = `
        SELECT COUNT(*) as count
        FROM appointments
        WHERE therapist_id = $1
        AND appointment_date >= CURRENT_DATE
        AND status = 'confirmed'
      `;
      const upcomingResult = await db.query(upcomingQuery, [therapistId]);
      const upcomingSessions = parseInt(upcomingResult.rows[0].count) || 0;

      res.json({
        success: true,
        statistics: {
          pendingRequests: pendingRequests,
          todaySessions: todaySessions,
          weekSessions: weekSessions,
          upcomingSessions: upcomingSessions
        }
      });

    } catch (error) {
      console.error("Error fetching schedule statistics:", error);
      res.status(500).json({
        success: false,
        error: "Failed to load schedule statistics"
      });
    }
  }
);

// API routes for therapist requests
router.get(
  "/api/requests",
  requireAuth,
  requireTherapist,
  therapistController.getTherapistRequests
);
router.post(
  "/api/requests/respond",
  requireAuth,
  requireTherapist,
  therapistController.respondToRequest
);

// API route for panic session management (for therapists to save patient panic sessions)
// Temporarily disabled - function not implemented
// router.post(
//   "/api/panic-session/save",
//   requireAuth,
//   requireTherapist,
//   therapistController.savePanicSession
// );

// Patient therapist page (for patients to view their therapist)
router.get(
  "/my-therapist",
  requireAuth,
  therapistController.getPatientTherapistPage
);

// ===== THERAPIST-ADMIN COMMUNICATION ROUTES =====

// Therapist chat with admin
router.get("/chat", requireAuth, requireTherapist, (req, res) => {
  const action = req.query.action;
  const currentChatMode = action === "admin" ? "admin" : "patient";

  if (action === "admin") {
    res.render("pages/therapist/admin-chat", {
      title: "Chat with Admin",
      subtitle: "Communicate with administrators",
      user: req.session.user,
      profileImageUrl: getProfileImageUrl(req.session.user),
      currentPage: "chat",
      currentChatMode: currentChatMode,
      layout: "layouts/patient", // Use patient layout (hides navbar/footer for chat pages)
    });
  } else {
    res.render("pages/therapist/chat", {
      title: "Patient Chat",
      subtitle: "Chat with your patients",
      user: req.session.user,
      profileImageUrl: getProfileImageUrl(req.session.user),
      currentPage: "chat",
      currentChatMode: currentChatMode,
      layout: "layouts/patient", // Use patient layout (hides navbar/footer for chat pages)
    });
  }
});

// Get therapist-admin conversations (FIXED)
router.get(
  "/api/admin-conversations",
  requireAuth,
  requireTherapist,
  async (req, res) => {
    try {
      const therapistId = parseInt(req.session.user.id);

      // Validate therapistId
      if (isNaN(therapistId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid therapist ID",
        });
      }

      // First, ensure there's an admin conversation for this therapist
      const conversationId = await ensureAdminConversation(therapistId);

      // If no admin conversation could be created (no admin users), return empty array
      if (!conversationId) {
        console.log(
          "No admin conversation could be created - no admin users exist"
        );
        return res.json({
          success: true,
          conversations: [],
        });
      }

      // Query using unified conversations table
      // Therapist-admin conversations: patient_id = therapist, therapist_id = admin
      const conversationsQuery = `
        SELECT c.*,
               u.name as admin_name,
               u.email as admin_email,
               m.content as last_message,
               m.created_at as last_message_time,
               COUNT(CASE WHEN m2.is_read = false AND m2.sender_id != $1 THEN 1 END) as unread_count
        FROM conversations c
        JOIN users u ON c.therapist_id = u.id
        LEFT JOIN messages m ON c.id = m.conversation_id
          AND m.created_at = (SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id)
        LEFT JOIN messages m2 ON c.id = m2.conversation_id
        WHERE c.patient_id = $1
          AND c.conversation_type = 'admin'
          AND (c.status IS NULL OR c.status = 'active')
        GROUP BY c.id, u.name, u.email, m.content, m.created_at
        ORDER BY COALESCE(m.created_at, c.created_at) DESC
      `;

      const result = await db.query(conversationsQuery, [therapistId]);

      // Format conversations to match expected structure
      const formattedConversations = (result.rows || []).map((conv) => ({
        id: conv.id,
        other_user_name: conv.admin_name,
        other_user_role: "admin",
        other_user_specialty: "Admin Support",
        last_message: conv.last_message,
        last_message_time: conv.last_message_time,
        unread_count: parseInt(conv.unread_count) || 0,
        created_at: conv.created_at,
        admin_name: conv.admin_name,
        admin_email: conv.admin_email,
        is_admin_chat: true,
        conversation_type: "admin",
      }));

      res.json({
        success: true,
        conversations: formattedConversations,
      });
    } catch (error) {
      console.error("Error loading therapist-admin conversations:", error);
      res.status(500).json({
        success: false,
        error: "Failed to load conversations",
      });
    }
  }
);

// Helper function to ensure admin conversation exists
async function ensureAdminConversation(therapistId) {
  try {
    // Check if admin conversation already exists
    const existingQuery = `
      SELECT id FROM conversations
      WHERE patient_id = $1 AND conversation_type = 'admin'
    `;
    const existingResult = await db.query(existingQuery, [therapistId]);

    if (existingResult.rows.length > 0) {
      return existingResult.rows[0].id; // Return existing conversation ID
    }

    // Find an admin user to create conversation with
    const adminQuery = `
      SELECT id, name, email FROM users
      WHERE role = 'admin'
      ORDER BY id ASC
      LIMIT 1
    `;
    const adminResult = await db.query(adminQuery);

    if (adminResult.rows.length === 0) {
      console.log("No admin users found - cannot create admin conversation");
      return null;
    }

    const adminUser = adminResult.rows[0];

    // Create admin conversation
    const createQuery = `
      INSERT INTO conversations (patient_id, therapist_id, conversation_type, status, created_at, updated_at)
      VALUES ($1, $2, 'admin', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;
    const createResult = await db.query(createQuery, [
      therapistId,
      adminUser.id,
    ]);

    console.log(
      `Created admin conversation for therapist ${therapistId} with admin ${adminUser.id}`
    );
    return createResult.rows[0].id;
  } catch (error) {
    console.error("Error ensuring admin conversation:", error);
    return null;
  }
}

// Get messages for therapist-admin conversation (FIXED)
router.get(
  "/api/admin-conversations/:conversationId/messages",
  requireAuth,
  requireTherapist,
  async (req, res) => {
    try {
      const conversationId = req.params.conversationId;
      const therapistId = parseInt(req.session.user.id);

      // Validate parameters
      if ((!conversationId || (isNaN(parseInt(conversationId)) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId))) || isNaN(therapistId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid conversation ID or therapist ID",
        });
      }

      // Verify conversation belongs to this therapist
      const verifyQuery = `
        SELECT c.*, u.name as admin_name
        FROM conversations c
        JOIN users u ON c.therapist_id = u.id
        WHERE c.id = $1
          AND c.patient_id = $2
          AND c.conversation_type = 'admin'
          AND (c.status IS NULL OR c.status = 'active')
      `;
      const verifyResult = await db.query(verifyQuery, [
        conversationId,
        therapistId,
      ]);

      if (verifyResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
      }

      const conversation = verifyResult.rows[0];

      // Get messages using unified messages table
      const messagesQuery = `
        SELECT m.*, u.name as sender_name, u.role as sender_role
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = $1
        ORDER BY m.created_at ASC
      `;
      const messagesResult = await db.query(messagesQuery, [conversationId]);

      // Mark messages as read
      await db.query(
        "UPDATE messages SET is_read = true WHERE conversation_id = $1 AND sender_id != $2",
        [conversationId, therapistId]
      );

      res.json({
        success: true,
        conversation: {
          id: conversation.id,
          admin_name: conversation.admin_name,
          other_user: {
            id: conversation.therapist_id,
            name: conversation.admin_name,
            role: "admin",
            specialty: "Admin Support",
          },
        },
        messages: messagesResult.rows || [],
      });
    } catch (error) {
      console.error("Error loading therapist-admin messages:", error);
      res.status(500).json({
        success: false,
        error: "Failed to load messages",
      });
    }
  }
);

// Get enhanced messages for therapist-admin conversation
router.get(
  "/api/admin-conversations/:conversationId/enhanced-messages",
  requireAuth,
  requireTherapist,
  async (req, res) => {
    try {
      const conversationId = req.params.conversationId;
      const therapistId = parseInt(req.session.user.id);

      // Validate parameters
      if ((!conversationId || (isNaN(parseInt(conversationId)) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId))) || isNaN(therapistId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid conversation ID or therapist ID",
        });
      }

      // Verify conversation belongs to this therapist
      const verifyQuery = `
        SELECT c.*, u.name as admin_name
        FROM conversations c
        JOIN users u ON c.therapist_id = u.id
        WHERE c.id = $1
          AND c.patient_id = $2
          AND c.conversation_type = 'admin'
          AND (c.status IS NULL OR c.status = 'active')
      `;
      const verifyResult = await db.query(verifyQuery, [
        conversationId,
        therapistId,
      ]);

      if (verifyResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
      }

      const conversation = verifyResult.rows[0];

      // Get messages using unified messages table
      const messagesQuery = `
        SELECT m.*, u.name as sender_name, u.role as sender_role
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = $1
        ORDER BY m.created_at ASC
      `;
      const messagesResult = await db.query(messagesQuery, [conversationId]);

      // Mark messages as read
      await db.query(
        "UPDATE messages SET is_read = true WHERE conversation_id = $1 AND sender_id != $2",
        [conversationId, therapistId]
      );

      res.json({
        success: true,
        conversation: {
          id: conversation.id,
          admin_name: conversation.admin_name,
          other_user: {
            id: conversation.therapist_id,
            name: conversation.admin_name,
            role: "admin",
            specialty: "Admin Support",
          },
        },
        messages: messagesResult.rows || [],
      });
    } catch (error) {
      console.error("Error loading therapist-admin enhanced messages:", error);
      res.status(500).json({
        success: false,
        error: "Failed to load messages",
      });
    }
  }
);

// Send message to admin (FIXED)
router.post(
  "/api/admin-conversations/:conversationId/messages",
  requireAuth,
  requireTherapist,
  async (req, res) => {
    try {
      const conversationId = req.params.conversationId;
      const { content } = req.body;
      const therapistId = parseInt(req.session.user.id);

      // Validate parameters
      if ((!conversationId || (isNaN(parseInt(conversationId)) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId))) || isNaN(therapistId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid conversation ID or therapist ID",
        });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Message content is required",
        });
      }

      // Verify conversation belongs to this therapist
      const verifyQuery = `
        SELECT id, therapist_id as admin_id
        FROM conversations
        WHERE id = $1
          AND patient_id = $2
          AND conversation_type = 'admin'
          AND (status IS NULL OR status = 'active')
      `;
      const verifyResult = await db.query(verifyQuery, [
        conversationId,
        therapistId,
      ]);

      if (verifyResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
      }

      // Send message using unified messages table
      const messageQuery = `
        INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at)
        VALUES ($1, $2, $3, 'text', CURRENT_TIMESTAMP)
        RETURNING id, created_at
      `;
      const messageResult = await db.query(messageQuery, [
        conversationId,
        therapistId,
        content.trim(),
      ]);

      // Update conversation timestamp
      await db.query(
        "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [conversationId]
      );

      // Notify admin
      const adminId = verifyResult.rows[0].admin_id;
      try {
        const notificationQuery = `
          INSERT INTO notifications (user_id, type, title, message, data, created_at)
          VALUES ($1, 'therapist_message', 'Message from Therapist',
                  'You have a new message from a therapist.', $2, CURRENT_TIMESTAMP)
        `;
        await db.query(notificationQuery, [
          adminId,
          JSON.stringify({
            conversationId: conversationId,
            therapistId: therapistId,
            messageId: messageResult.rows[0].id,
          }),
        ]);
      } catch (notifyError) {
        console.log(
          "Notification creation failed (non-critical):",
          notifyError.message
        );
      }

      res.json({
        success: true,
        message: {
          id: messageResult.rows[0].id,
          conversation_id: conversationId,
          sender_id: therapistId,
          content: content.trim(),
          message_type: "text",
          created_at: messageResult.rows[0].created_at,
          sender_name: req.session.user.name,
          sender_role: "therapist",
        },
      });
    } catch (error) {
      console.error("Error sending therapist-admin message:", error);
      res.status(500).json({
        success: false,
        error: "Failed to send message",
      });
    }
  }
);

module.exports = router;
