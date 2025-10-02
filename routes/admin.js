// routes/admin.js - COMPLETE with Working Admin Chat
const express = require("express");
const router = express.Router();
const { requireAuth, requireAdmin } = require("../middleware/auth");
const db = require("../config/database");
const adminController = require("../controllers/adminController");

// Admin dashboard
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    // Fetch dashboard statistics
    const stats = await adminController.getDashboardStats(req, res);

    // Get user statistics
    const userStatsQuery = `
      SELECT
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin,
        COUNT(CASE WHEN role = 'therapist' THEN 1 END) as therapist,
        COUNT(CASE WHEN role = 'patient' THEN 1 END) as patient,
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'therapist' AND id IN (SELECT user_id FROM therapist_applications WHERE status = 'approved') THEN 1 END) as total_therapists,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_this_month
      FROM users
    `;
    const userStatsResult = await db.query(userStatsQuery);
    const userStats = userStatsResult.rows[0];

    res.render("pages/admin/dashboard", {
      title: "Admin Dashboard",
      user: req.session.user,
      userStats: userStats,
      stats: stats,
      pendingApplications: stats.pending_applications,
    });
  } catch (error) {
    console.error("Error loading admin dashboard:", error);
    res.render("pages/admin/dashboard", {
      title: "Admin Dashboard",
      user: req.session.user,
      userStats: {
        admin: 1,
        therapist: 0,
        patient: 0,
        total_users: 0,
        total_therapists: 0,
        new_users_this_month: 0,
      },
      stats: {
        total_applications: 0,
        pending_applications: 0,
        approved_applications: 0,
        rejected_applications: 0,
        applications_this_week: 0,
        applications_this_month: 0,
      },
      pendingApplications: 0,
    });
  }
});

// Admin chat interface
router.get("/chat", requireAuth, requireAdmin, (req, res) => {
  res.render("pages/admin/admin-chat-list", {
    title: "Admin Chat",
    user: req.session.user,
  });
});

// Applications page
router.get("/applications", requireAuth, requireAdmin, (req, res) => {
  res.render("pages/admin/applications", {
    title: "Therapist Applications",
    user: req.session.user,
    applications: [],
  });
});

// Therapists page
router.get("/therapists", requireAuth, requireAdmin, (req, res) => {
  res.render("pages/admin/therapists", {
    title: "Manage Therapists",
    user: req.session.user,
    therapists: [],
  });
});

// ===== ADMIN CHAT ROUTES =====

// Get patients for admin chat
router.get("/chat/patients", requireAuth, requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.name, u.email, u.created_at, u.profile_image,
             COUNT(DISTINCT a.id) as appointment_count
      FROM users u
      LEFT JOIN appointments a ON u.id = a.patient_id
      WHERE u.role = 'patient'
      GROUP BY u.id, u.name, u.email, u.created_at, u.profile_image
      ORDER BY u.created_at DESC
    `;
    const result = await db.query(query);

    res.json({
      success: true,
      patients: result.rows || [],
    });
  } catch (error) {
    console.error("Error loading patients:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load patients",
    });
  }
});

// Get therapists for admin chat
router.get("/chat/therapists", requireAuth, requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.name, u.email, u.created_at,
              ta.specialty, ta.profile_image
      FROM users u
      LEFT JOIN therapist_applications ta ON u.id = ta.user_id AND ta.status = 'approved'
      WHERE u.role = 'therapist'
      ORDER BY u.created_at DESC
    `;
    const result = await db.query(query);

    res.json({
      success: true,
      therapists: result.rows || [],
    });
  } catch (error) {
    console.error("Error loading therapists:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load therapists",
    });
  }
});

// Get admin conversations - Allow both admins and therapists
router.get("/chat/conversations", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.session.user.id);
    const userRole = req.session.user.role;

    // If therapist is accessing admin chat, redirect to therapist-admin communication
    if (userRole === "therapist") {
      return res.redirect("/therapist/chat?action=admin");
    }

    // Admin accessing admin chat - use admin controller
    if (userRole === "admin") {
      const adminController = require("../controllers/adminController");
      await adminController.getAdminConversations(req, res);
    } else {
      res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }
  } catch (error) {
    console.error("Error loading admin conversations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load conversations",
    });
  }
});

// Get admin conversations (alternative endpoint for compatibility) - Allow both admins and therapists
router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.session.user.id);
    const userRole = req.session.user.role;

    // If therapist is accessing admin conversations, redirect to regular chat
    if (userRole === "therapist") {
      return res.redirect("/appointments/chat/conversations");
    }

    // Admin accessing admin conversations - use admin controller
    if (userRole === "admin") {
      const adminController = require("../controllers/adminController");
      await adminController.getAdminConversations(req, res);
    } else {
      res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }
  } catch (error) {
    console.error("Error loading admin conversations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load conversations",
    });
  }
});

// Get messages for admin conversation - Allow both admins and therapists
router.get("/chat/:conversationId/messages", requireAuth, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const userId = parseInt(req.session.user.id);
    const userRole = req.session.user.role;

    // If therapist is accessing admin chat, redirect to therapist-admin communication
    if (userRole === "therapist") {
      return res.redirect(
        `/therapist/chat?action=admin&conversationId=${conversationId}`
      );
    }

    // Admin accessing admin chat - use admin controller
    if (userRole === "admin") {
      const adminController = require("../controllers/adminController");
      req.params.conversationId = conversationId;
      req.session.user.id = userId;
      await adminController.getAdminMessages(req, res);
    } else {
      res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }
  } catch (error) {
    console.error("Error loading admin messages:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load messages",
    });
  }
});

// Get messages for admin conversation (alternative endpoint for compatibility) - Allow both admins and therapists
router.get("/messages/:conversationId", requireAuth, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const userId = parseInt(req.session.user.id);
    const userRole = req.session.user.role;

    // If therapist is accessing admin messages, redirect to regular chat
    if (userRole === "therapist") {
      return res.redirect(
        `/appointments/chat/${conversationId}/messages`
      );
    }

    // Admin accessing admin messages - use admin controller
    if (userRole === "admin") {
      const adminController = require("../controllers/adminController");
      req.params.conversationId = conversationId;
      req.session.user.id = userId;
      await adminController.getAdminMessages(req, res);
    } else {
      res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }
  } catch (error) {
    console.error("Error loading admin messages:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load messages",
    });
  }
});

// Send admin message - Allow both admins and therapists for therapist-admin communication
router.post("/chat/:conversationId/send", requireAuth, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const { content } = req.body;
    const userId = parseInt(req.session.user.id);
    const userRole = req.session.user.role;

    // If therapist is sending message to admin, handle therapist-admin communication
    if (userRole === "therapist") {
      // Create or get therapist-admin conversation
      const adminQuery = `SELECT id FROM users WHERE role = 'admin' LIMIT 1`;
      const adminResult = await db.query(adminQuery);

      if (adminResult.rows.length === 0) {
        return res.status(500).json({
          success: false,
          error: "No admin available",
        });
      }

      const adminId = adminResult.rows[0].id;

      // Check if therapist-admin conversation exists
      const existingQuery = `
          SELECT id FROM therapist_admin_conversations
          WHERE therapist_id = $1 AND admin_id = $2 AND status = 'active'
        `;
      const existingResult = await db.query(existingQuery, [userId, adminId]);

      let conversationIdToUse = conversationId;
      if (existingResult.rows.length === 0) {
        // Create new therapist-admin conversation
        const newConversationId = require("uuid").v4();
        const createQuery = `
            INSERT INTO therapist_admin_conversations (id, therapist_id, admin_id, status, created_at, updated_at)
            VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `;
        await db.query(createQuery, [newConversationId, userId, adminId]);
        conversationIdToUse = newConversationId;
      } else {
        conversationIdToUse = existingResult.rows[0].id;
      }

      // Send message in therapist-admin conversation
      const messageQuery = `
          INSERT INTO therapist_admin_messages (conversation_id, sender_id, content, message_type, created_at)
          VALUES ($1, $2, $3, 'text', CURRENT_TIMESTAMP)
          RETURNING id, created_at
        `;
      const messageResult = await db.query(messageQuery, [
        conversationIdToUse,
        userId,
        content.trim(),
      ]);

      // Update conversation timestamp
      await db.query(
        "UPDATE therapist_admin_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [conversationIdToUse]
      );

      // Notify admin
      const notificationQuery = `
          INSERT INTO notifications (user_id, type, title, message, data, created_at)
          VALUES ($1, 'therapist_message', 'Message from Therapist',
                  'You have a new message from a therapist.', $2, CURRENT_TIMESTAMP)
        `;
      await db.query(notificationQuery, [
        adminId,
        JSON.stringify({
          conversationId: conversationIdToUse,
          therapistId: userId,
          messageId: messageResult.rows[0].id,
        }),
      ]);

      return res.json({
        success: true,
        message: {
          id: messageResult.rows[0].id,
          conversation_id: conversationIdToUse,
          sender_id: userId,
          content: content.trim(),
          message_type: "text",
          created_at: messageResult.rows[0].created_at,
          sender_name: req.session.user.name,
          sender_role: "therapist",
        },
      });
    }

    // Admin sending message - use admin controller
    if (userRole === "admin") {
      const adminController = require("../controllers/adminController");
      req.params.conversationId = conversationId;
      req.body.content = content;
      req.session.user.id = userId;
      await adminController.sendAdminMessage(req, res);
    } else {
      res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }
  } catch (error) {
    console.error("Error sending admin message:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send message",
    });
  }
});

// Send admin message (alternative endpoint for compatibility) - Allow both admins and therapists
router.post("/messages/:conversationId/send", requireAuth, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const { content } = req.body;
    const userId = parseInt(req.session.user.id);
    const userRole = req.session.user.role;

    // If therapist is sending message, redirect to regular chat
    if (userRole === "therapist") {
      return res.redirect(
        307,
        `/appointments/chat/${conversationId}/send`
      );
    }

    // Admin sending message - use admin controller
    if (userRole === "admin") {
      const adminController = require("../controllers/adminController");
      req.params.conversationId = conversationId;
      req.body.content = content;
      req.session.user.id = userId;
      await adminController.sendAdminMessage(req, res);
    } else {
      res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }
  } catch (error) {
    console.error("Error sending admin message:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send message",
    });
  }
});

// Start admin conversation
router.post("/chat/start", requireAuth, requireAdmin, async (req, res) => {
  const { participantId, participantType, message } = req.body;
  const adminId = parseInt(req.session.user.id);

  try {
    console.log("Admin starting conversation:", {
      adminId,
      participantId,
      participantType,
    });

    // Use the admin controller function
    const adminController = require("../controllers/adminController");
    req.body = { participantId, participantType, message };
    await adminController.startConversationWith(req, res);
  } catch (error) {
    console.error("Error starting admin conversation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start conversation",
    });
  }
});

// Send admin message
router.post(
  "/chat/:conversationId/send",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const conversationId = req.params.conversationId;
    const { content } = req.body;
    const adminId = parseInt(req.session.user.id);

    try {
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Message content is required",
        });
      }

      // Insert message
      const messageQuery = `
      INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at)
      VALUES ($1, $2, $3, 'text', CURRENT_TIMESTAMP)
      RETURNING id, created_at
    `;

      const messageResult = await db.query(messageQuery, [
        conversationId,
        adminId,
        content.trim(),
      ]);

      // Update conversation timestamp
      await db.query(
        "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [conversationId]
      );

      res.json({
        success: true,
        message: {
          id: messageResult.rows[0].id,
          conversation_id: conversationId,
          sender_id: adminId,
          content: content.trim(),
          message_type: "text",
          created_at: messageResult.rows[0].created_at,
          sender_name: req.session.user.name,
          sender_role: "admin",
        },
      });
    } catch (error) {
      console.error("Error sending admin message:", error);
      res.status(500).json({
        success: false,
        error: "Failed to send message",
      });
    }
  }
);

// Get admin messages
router.get(
  "/chat/:conversationId/messages",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const conversationId = req.params.conversationId;
    const adminId = parseInt(req.session.user.id);

    try {
      // Get conversation details
      const convQuery = `
      SELECT c.*, u.name as participant_name, u.role as participant_role
      FROM conversations c
      JOIN users u ON c.patient_id = u.id
      WHERE c.id = $1 AND c.therapist_id = $2
    `;

      const convResult = await db.query(convQuery, [conversationId, adminId]);

      if (!convResult.rows || convResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
      }

      const conversation = convResult.rows[0];

      // Get messages
      const messagesQuery = `
      SELECT m.*, u.name as sender_name, u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `;

      const messagesResult = await db.query(messagesQuery, [conversationId]);

      res.json({
        success: true,
        conversation: {
          id: conversation.id,
          other_user: {
            id: conversation.patient_id,
            name: conversation.participant_name,
            role: conversation.participant_role,
            specialty:
              conversation.participant_role === "therapist"
                ? "Therapist"
                : "Patient",
          },
        },
        messages: messagesResult.rows || [],
        isAdminConversation: true,
      });
    } catch (error) {
      console.error("Error fetching admin messages:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch messages",
      });
    }
  }
);

// Submit patient concern
router.post(
  "/submit-patient-concern",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const adminId = parseInt(req.session.user.id);
      const { patientId, concernType, severity, title, description } = req.body;

      if (!patientId || !concernType || !severity || !title || !description) {
        return res.status(400).json({
          success: false,
          error: "All fields are required",
        });
      }

      const insertQuery = `
      INSERT INTO patient_concerns 
      (patient_id, admin_id, concern_type, severity, title, description, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'open', CURRENT_TIMESTAMP)
      RETURNING id
    `;

      const result = await db.query(insertQuery, [
        parseInt(patientId),
        adminId,
        concernType,
        severity,
        title,
        description,
      ]);

      res.json({
        success: true,
        message: "Patient concern submitted successfully",
        concernId: result.rows[0].id,
      });
    } catch (error) {
      console.error("Error submitting patient concern:", error);
      res.status(500).json({
        success: false,
        error: "Failed to submit patient concern",
      });
    }
  }
);

// Send therapist contract
router.post(
  "/send-therapist-contract",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const adminId = parseInt(req.session.user.id);
      const {
        therapistId,
        contractType,
        title,
        content,
        requiresAcknowledgment,
        acknowledgmentDeadline,
      } = req.body;

      if (!therapistId || !contractType || !title || !content) {
        return res.status(400).json({
          success: false,
          error: "All required fields must be provided",
        });
      }

      const insertQuery = `
      INSERT INTO therapist_contracts 
      (therapist_id, admin_id, contract_type, title, content, 
       requires_acknowledgment, acknowledgment_deadline, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent', CURRENT_TIMESTAMP)
      RETURNING id
    `;

      const deadline = acknowledgmentDeadline
        ? new Date(acknowledgmentDeadline)
        : null;
      const result = await db.query(insertQuery, [
        parseInt(therapistId),
        adminId,
        contractType,
        title,
        content,
        requiresAcknowledgment || false,
        deadline,
      ]);

      res.json({
        success: true,
        message: "Contract sent to therapist successfully",
        contractId: result.rows[0].id,
      });
    } catch (error) {
      console.error("Error sending therapist contract:", error);
      res.status(500).json({
        success: false,
        error: "Failed to send therapist contract",
      });
    }
  }
);

// Get therapist messages for admin (FIXED)
router.get("/therapist-messages", requireAuth, requireAdmin, async (req, res) => {
  try {
    const adminId = parseInt(req.session.user.id);

    // Query using unified tables
    // Admin conversations: therapist as patient_id, admin as therapist_id
    const query = `
      SELECT m.*, u.name as therapist_name, u.email as therapist_email,
             c.patient_id as therapist_id, c.therapist_id as admin_id
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN users u ON c.patient_id = u.id
      WHERE c.therapist_id = $1
        AND c.conversation_type = 'admin'
        AND (c.status IS NULL OR c.status = 'active')
        AND u.role = 'therapist'
      ORDER BY m.created_at DESC
      LIMIT 50
    `;

    const result = await db.query(query, [adminId]);
    const messages = result.rows || [];

    res.json({
      success: true,
      messages: messages
    });
  } catch (error) {
    console.error("Error loading therapist messages:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load therapist messages"
    });
  }
});

// Get specific therapist conversation for admin (FIXED)
router.get("/therapist-messages/:conversationId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const adminId = parseInt(req.session.user.id);

    // Get conversation details using unified table
    const convQuery = `
      SELECT c.*, u.name as therapist_name, u.email as therapist_email
      FROM conversations c
      JOIN users u ON c.patient_id = u.id
      WHERE c.id = $1
        AND c.therapist_id = $2
        AND c.conversation_type = 'admin'
        AND (c.status IS NULL OR c.status = 'active')
    `;
    const convResult = await db.query(convQuery, [conversationId, adminId]);

    if (convResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found"
      });
    }

    const conversation = convResult.rows[0];

    // Get messages using unified messages table
    const messagesQuery = `
      SELECT m.*, u.name as sender_name, u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `;
    const messagesResult = await db.query(messagesQuery, [conversationId]);

    res.json({
      success: true,
      conversation: conversation,
      messages: messagesResult.rows || []
    });
  } catch (error) {
    console.error("Error loading therapist conversation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load conversation"
    });
  }
});

// Send reply to therapist message (FIXED)
router.post("/therapist-messages/:conversationId/reply", requireAuth, requireAdmin, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const { content } = req.body;
    const adminId = parseInt(req.session.user.id);

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Message content is required"
      });
    }

    // Verify conversation exists and admin is part of it
    const verifyQuery = `
      SELECT c.*, u.name as therapist_name, c.patient_id as therapist_id
      FROM conversations c
      JOIN users u ON c.patient_id = u.id
      WHERE c.id = $1
        AND c.therapist_id = $2
        AND c.conversation_type = 'admin'
        AND (c.status IS NULL OR c.status = 'active')
    `;
    const verifyResult = await db.query(verifyQuery, [conversationId, adminId]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found"
      });
    }

    // Send message using unified messages table
    const messageQuery = `
      INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at)
      VALUES ($1, $2, $3, 'text', CURRENT_TIMESTAMP)
      RETURNING id, created_at
    `;
    const messageResult = await db.query(messageQuery, [conversationId, adminId, content.trim()]);

    // Update conversation timestamp
    await db.query(
      "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [conversationId]
    );

    // Create notification for therapist
    const therapistId = verifyResult.rows[0].therapist_id;
    try {
      const notificationQuery = `
        INSERT INTO notifications (user_id, type, title, message, data, created_at)
        VALUES ($1, 'admin_reply', 'Reply from Admin',
                'You have a new reply from admin.', $2, CURRENT_TIMESTAMP)
      `;
      await db.query(notificationQuery, [therapistId, JSON.stringify({
        conversationId: conversationId,
        messageId: messageResult.rows[0].id
      })]);
    } catch (notifyError) {
      console.log('Notification creation failed (non-critical):', notifyError.message);
    }

    res.json({
      success: true,
      message: {
        id: messageResult.rows[0].id,
        conversation_id: conversationId,
        sender_id: adminId,
        content: content.trim(),
        message_type: 'text',
        created_at: messageResult.rows[0].created_at,
        sender_name: req.session.user.name,
        sender_role: 'admin'
      }
    });
  } catch (error) {
    console.error("Error sending therapist reply:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send reply"
    });
  }
});

// Close conversation
router.post(
  "/close-conversation/:conversationId",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const adminId = parseInt(req.session.user.id);
      const conversationId = req.params.conversationId;
      const { reason } = req.body;

      await db.query(
        `UPDATE conversations
       SET status = 'closed', closed_at = CURRENT_TIMESTAMP,
           closed_by = $2, closure_reason = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
        [conversationId, adminId, reason || "Admin closed"]
      );

      const finalMessage = reason
        ? `This conversation has been closed by admin. Reason: ${reason}`
        : "This conversation has been closed by admin.";

      await db.query(
        "INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at) VALUES ($1, $2, $3, 'system', CURRENT_TIMESTAMP)",
        [conversationId, adminId, finalMessage]
      );

      res.json({
        success: true,
        message: "Conversation closed successfully",
      });
    } catch (error) {
      console.error("Error closing conversation:", error);
      res.status(500).json({
        success: false,
        error: "Failed to close conversation",
      });
    }
  }
);

module.exports = router;
