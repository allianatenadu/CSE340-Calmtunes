// controllers/chatController.js - ENHANCED VERSION with Advanced Chat Features
const db = require("../config/database");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../public/uploads/chat-files");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow images, documents, and other common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp4|webm|ogg/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only images, documents, and media files are allowed."
        )
      );
    }
  },
});

// Enhanced message sending with file support
exports.sendMessageWithFile = async (req, res) => {
  const { conversationId } = req.params;
  const { content, replyToId } = req.body;
  const userId = req.session?.user?.id;
  const userName = req.session?.user?.name;
  const userRole = req.session?.user?.role;

  try {
    // Verify conversation access
    const verifyQuery = `
      SELECT c.*,
             up.name as patient_name,
             ut.name as therapist_name
      FROM conversations c
      JOIN users up ON c.patient_id = up.id
      JOIN users ut ON c.therapist_id = ut.id
      WHERE c.id = $1
        AND (c.patient_id = $2 OR c.therapist_id = $2)
        AND (c.status IS NULL OR c.status = 'active')
    `;

    const verifyResult = await new Promise((resolve, reject) => {
      db.query(verifyQuery, [conversationId, userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (!verifyResult.rows || verifyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found or access denied",
      });
    }

    const conversation = verifyResult.rows[0];
    let messageType = "text";
    let fileData = null;

    // Handle file upload if present
    if (req.file) {
      messageType = req.file.mimetype.startsWith("image/") ? "image" : "file";

      fileData = {
        file_url: `/uploads/chat-files/${req.file.filename}`,
        file_name: req.file.originalname,
        file_size: req.file.size,
        file_type: path.extname(req.file.originalname).substring(1),
        mime_type: req.file.mimetype,
        image_width: req.file.mimetype.startsWith("image/") ? null : null, // Would need image processing for this
        image_height: req.file.mimetype.startsWith("image/") ? null : null,
        thumbnail_url: req.file.mimetype.startsWith("image/")
          ? `/uploads/chat-files/${req.file.filename}`
          : null,
      };
    }

    // Insert message with enhanced fields
    const messageQuery = `
      INSERT INTO messages (
        conversation_id, sender_id, content, message_type, message_status,
        file_url, file_name, file_size, file_type, mime_type,
        reply_to_id, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
      RETURNING id, created_at
    `;

    const messageValues = [
      conversationId,
      userId,
      content ? content.trim() : req.file ? req.file.originalname : "",
      messageType,
      "sent", // Initial status
      fileData?.file_url || null,
      fileData?.file_name || null,
      fileData?.file_size || null,
      fileData?.file_type || null,
      fileData?.mime_type || null,
      replyToId || null,
      JSON.stringify(fileData ? { file_info: fileData } : {}),
    ];

    const messageResult = await new Promise((resolve, reject) => {
      db.query(messageQuery, messageValues, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    // Update conversation timestamp
    await new Promise((resolve, reject) => {
      db.query(
        "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [conversationId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Get other participant ID for notification
    const otherUserId =
      conversation.patient_id === userId
        ? conversation.therapist_id
        : conversation.patient_id;

    // Create notification
    await createNotification(
      otherUserId,
      conversation.conversation_type === "admin"
        ? "admin_message"
        : "new_message",
      userRole === "admin" ? "New Message from Admin" : "New Message",
      `${userName} sent you a message`,
      { conversationId: conversationId }
    );

    // Update message status to delivered
    await new Promise((resolve, reject) => {
      db.query(
        "UPDATE messages SET message_status = 'delivered' WHERE id = $1",
        [messageResult.rows[0].id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Emit real-time message via socket
    const io = req.app?.get("io");
    if (io) {
      io.to(conversationId).emit("new_message", {
        id: messageResult.rows[0].id,
        conversationId: conversationId,
        senderId: userId,
        content: content ? content.trim() : "",
        messageType: messageType,
        messageStatus: "delivered",
        fileUrl: fileData?.file_url || null,
        fileName: fileData?.file_name || null,
        fileSize: fileData?.file_size || null,
        fileType: fileData?.file_type || null,
        mimeType: fileData?.mime_type || null,
        replyToId: replyToId || null,
        createdAt: messageResult.rows[0].created_at,
        senderName: userName,
        senderRole: userRole,
      });
    }

    res.json({
      success: true,
      message: {
        id: messageResult.rows[0].id,
        conversation_id: conversationId,
        sender_id: userId,
        content: content ? content.trim() : "",
        message_type: messageType,
        message_status: "delivered",
        file_url: fileData?.file_url || null,
        file_name: fileData?.file_name || null,
        reply_to_id: replyToId || null,
        created_at: messageResult.rows[0].created_at,
        sender_name: userName,
        sender_role: userRole,
      },
    });
  } catch (error) {
    console.error("Error sending enhanced message:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send message",
    });
  }
};

// Add message reaction
exports.addMessageReaction = async (req, res) => {
  const { messageId } = req.params;
  const { reactionType } = req.body;
  const userId = req.session?.user?.id;

  try {
    // Verify message exists and user has access
    const messageQuery = `
      SELECT m.*, c.patient_id, c.therapist_id
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.id = $1 AND (c.patient_id = $2 OR c.therapist_id = $2)
    `;

    const messageResult = await new Promise((resolve, reject) => {
      db.query(messageQuery, [messageId, userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (!messageResult.rows || messageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Message not found or access denied",
      });
    }

    // Add or update reaction
    const upsertQuery = `
      INSERT INTO message_reactions (message_id, user_id, reaction_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (message_id, user_id, reaction_type)
      DO NOTHING
      RETURNING id
    `;

    const reactionResult = await new Promise((resolve, reject) => {
      db.query(
        upsertQuery,
        [messageId, userId, reactionType],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    // Get updated reactions for the message
    const reactionsQuery = `
      SELECT reaction_type, COUNT(*) as count
      FROM message_reactions
      WHERE message_id = $1
      GROUP BY reaction_type
    `;

    const reactionsResult = await new Promise((resolve, reject) => {
      db.query(reactionsQuery, [messageId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    // Update message reactions in JSONB field for quick access
    const reactionsObj = {};
    reactionsResult.rows.forEach((row) => {
      reactionsObj[row.reaction_type] = parseInt(row.count);
    });

    await new Promise((resolve, reject) => {
      db.query(
        "UPDATE messages SET reactions = $1 WHERE id = $2",
        [JSON.stringify(reactionsObj), messageId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Emit real-time reaction update
    const io = req.app?.get("io");
    if (io) {
      io.to(messageResult.rows[0].conversation_id).emit("message_reaction", {
        messageId: messageId,
        userId: userId,
        reactionType: reactionType,
        reactions: reactionsObj,
      });
    }

    res.json({
      success: true,
      reactions: reactionsObj,
    });
  } catch (error) {
    console.error("Error adding reaction:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add reaction",
    });
  }
};

// Remove message reaction
exports.removeMessageReaction = async (req, res) => {
  const { messageId } = req.params;
  const { reactionType } = req.body;
  const userId = req.session?.user?.id;

  try {
    // Remove reaction
    const deleteQuery = `
      DELETE FROM message_reactions
      WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3
      RETURNING id
    `;

    const deleteResult = await new Promise((resolve, reject) => {
      db.query(
        deleteQuery,
        [messageId, userId, reactionType],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    if (!deleteResult.rows || deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Reaction not found",
      });
    }

    // Get updated reactions for the message
    const reactionsQuery = `
      SELECT reaction_type, COUNT(*) as count
      FROM message_reactions
      WHERE message_id = $1
      GROUP BY reaction_type
    `;

    const reactionsResult = await new Promise((resolve, reject) => {
      db.query(reactionsQuery, [messageId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    // Update message reactions in JSONB field
    const reactionsObj = {};
    reactionsResult.rows.forEach((row) => {
      reactionsObj[row.reaction_type] = parseInt(row.count);
    });

    await new Promise((resolve, reject) => {
      db.query(
        "UPDATE messages SET reactions = $1 WHERE id = $2",
        [JSON.stringify(reactionsObj), messageId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Emit real-time reaction update
    const io = req.app?.get("io");
    if (io) {
      io.to(messageResult.rows[0].conversation_id).emit(
        "message_reaction_removed",
        {
          messageId: messageId,
          userId: userId,
          reactionType: reactionType,
          reactions: reactionsObj,
        }
      );
    }

    res.json({
      success: true,
      reactions: reactionsObj,
    });
  } catch (error) {
    console.error("Error removing reaction:", error);
    res.status(500).json({
      success: false,
      error: "Failed to remove reaction",
    });
  }
};

// Update typing indicator
exports.updateTypingIndicator = async (req, res) => {
  const { conversationId } = req.params;
  const { isTyping } = req.body;
  const userId = req.session?.user?.id;

  try {
    // Verify conversation access
    const verifyQuery = `
      SELECT id FROM conversations
      WHERE id = $1 AND (patient_id = $2 OR therapist_id = $2)
    `;

    const verifyResult = await new Promise((resolve, reject) => {
      db.query(verifyQuery, [conversationId, userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (!verifyResult.rows || verifyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found or access denied",
      });
    }

    // Update or insert typing indicator
    const upsertQuery = `
      INSERT INTO typing_indicators (conversation_id, user_id, is_typing, last_typed)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (conversation_id, user_id)
      DO UPDATE SET
        is_typing = EXCLUDED.is_typing,
        last_typed = CURRENT_TIMESTAMP
      RETURNING id
    `;

    await new Promise((resolve, reject) => {
      db.query(
        upsertQuery,
        [conversationId, userId, isTyping],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    // Clean up old typing indicators (older than 10 seconds)
    await new Promise((resolve, reject) => {
      db.query(
        "DELETE FROM typing_indicators WHERE last_typed < CURRENT_TIMESTAMP - INTERVAL '10 seconds'",
        [],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Get current typing users
    const typingQuery = `
      SELECT u.name, ti.is_typing, ti.last_typed
      FROM typing_indicators ti
      JOIN users u ON ti.user_id = u.id
      WHERE ti.conversation_id = $1 AND ti.is_typing = true
        AND ti.last_typed > CURRENT_TIMESTAMP - INTERVAL '10 seconds'
    `;

    const typingResult = await new Promise((resolve, reject) => {
      db.query(typingQuery, [conversationId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    // Emit real-time typing update
    const io = req.app?.get("io");
    if (io) {
      io.to(conversationId).emit("typing_indicator", {
        conversationId: conversationId,
        typingUsers: typingResult.rows,
        userId: userId,
        isTyping: isTyping,
      });
    }

    res.json({
      success: true,
      typingUsers: typingResult.rows,
    });
  } catch (error) {
    console.error("Error updating typing indicator:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update typing indicator",
    });
  }
};

// Get enhanced messages with reactions and file info
exports.getEnhancedMessages = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.session.user.id;
  const userRole = req.session.user.role;

  try {
    console.log(
      "Getting enhanced messages for conversation:",
      conversationId,
      "user:",
      userId,
      "role:",
      userRole
    );

    const verifyQuery = `
      SELECT c.*,
             up.name as patient_name, up.email as patient_email, up.id as patient_id,
             ut.name as therapist_name, ut.email as therapist_email, ut.id as therapist_id,
             ta.profile_image as therapist_image, ta.specialty as therapist_specialty
      FROM conversations c
      JOIN users up ON c.patient_id = up.id
      JOIN users ut ON c.therapist_id = ut.id
      LEFT JOIN therapist_applications ta ON ut.id = ta.user_id
      WHERE c.id = $1 AND (c.patient_id = $2 OR c.therapist_id = $2)
    `;

    const verifyResult = await new Promise((resolve, reject) => {
      db.query(verifyQuery, [conversationId, userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (!verifyResult.rows || verifyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found or access denied",
      });
    }

    const conversation = verifyResult.rows[0];

    // Get enhanced messages with reactions and file info
    const messagesQuery = `
      SELECT m.*,
             u.name as sender_name, u.role as sender_role,
             u.profile_image as sender_user_profile_image,
             ta.profile_image as sender_therapist_profile_image,
             COALESCE(m.reactions, '{}'::jsonb) as reactions,
             r.user_reactions
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN therapist_applications ta ON u.id = ta.user_id AND u.role = 'therapist'
      LEFT JOIN (
        SELECT message_id,
               jsonb_object_agg(reaction_type, true) as user_reactions
        FROM message_reactions
        WHERE user_id = $2
        GROUP BY message_id
      ) r ON m.id = r.message_id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `;

    const messagesResult = await new Promise((resolve, reject) => {
      db.query(messagesQuery, [conversationId, userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    // Mark messages as read
    await new Promise((resolve, reject) => {
      db.query(
        "UPDATE messages SET message_status = 'read' WHERE conversation_id = $1 AND sender_id != $2 AND message_status != 'read'",
        [conversationId, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Determine other user based on role
    let otherUser;
    const isAdmin = conversation.conversation_type === "admin";

    if (isAdmin && userRole === "admin") {
      otherUser = {
        id: conversation.patient_id,
        name: conversation.patient_name,
        role: conversation.patient_role,
        image:
          conversation.patient_role === "therapist"
            ? conversation.therapist_image
            : null,
        specialty:
          conversation.patient_role === "therapist"
            ? conversation.therapist_specialty || "Therapist"
            : "Patient",
      };
    } else if (isAdmin) {
      otherUser = {
        id: conversation.therapist_id,
        name: conversation.therapist_name,
        role: "admin",
        image: null,
        specialty: "Admin Support",
      };
    } else {
      const isPatient = conversation.patient_id === userId;
      otherUser = isPatient
        ? {
            id: conversation.therapist_id,
            name: conversation.therapist_name,
            role: "therapist",
            image: conversation.therapist_image,
            specialty: conversation.therapist_specialty || "General Practice",
          }
        : {
            id: conversation.patient_id,
            name: conversation.patient_name,
            role: "patient",
            image: null,
            specialty: null,
          };
    }

    res.json({
      success: true,
      conversation: {
        id: conversation.id,
        patient_id: conversation.patient_id,
        therapist_id: conversation.therapist_id,
        conversation_type: conversation.conversation_type,
        other_user: otherUser,
      },
      messages: messagesResult.rows.map((msg) => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
        sender_name: msg.sender_name,
        sender_role: msg.sender_role,
        sender_user_profile_image: msg.sender_user_profile_image,
        sender_therapist_profile_image: msg.sender_therapist_profile_image,
        content: msg.content,
        message_type: msg.message_type,
        message_status: msg.message_status,
        file_url: msg.file_url,
        file_name: msg.file_name,
        file_size: msg.file_size,
        file_type: msg.file_type,
        mime_type: msg.mime_type,
        image_width: msg.image_width,
        image_height: msg.image_height,
        thumbnail_url: msg.thumbnail_url,
        reactions: msg.reactions,
        user_reactions: msg.user_reactions || {},
        reply_to_id: msg.reply_to_id,
        edited_at: msg.edited_at,
        metadata: msg.metadata,
        created_at: msg.created_at,
      })),
      isAdminConversation: isAdmin,
    });
  } catch (error) {
    console.error("Error fetching enhanced messages:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch messages",
    });
  }
};

// Add this to the end of chatController.js, before the createNotification function

// Start a new conversation
exports.startConversation = async (req, res) => {
  const userId = req.session.user.id;
  const userRole = req.session.user.role;

  try {
    console.log("Starting conversation for user:", userId, "role:", userRole);

    let patientId, therapistId;

    if (userRole === "patient") {
      patientId = userId;
      therapistId = req.body.therapistId;

      // Verify therapist exists and is approved
      if (therapistId) {
        const verifyTherapistQuery = `
          SELECT u.id, u.name, ta.status
          FROM users u
          JOIN therapist_applications ta ON u.id = ta.user_id
          WHERE u.id = $1 AND u.role = 'therapist' AND ta.status = 'approved'
        `;

        const verifyResult = await new Promise((resolve, reject) => {
          db.query(verifyTherapistQuery, [therapistId], (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });

        if (!verifyResult.rows || verifyResult.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: "Therapist not found or not approved",
          });
        }
      }
    } else if (userRole === "therapist") {
      patientId = req.body.patientId;
      therapistId = userId;
    } else {
      return res.status(400).json({
        success: false,
        error: "Invalid user role for starting conversation",
      });
    }

    if (!patientId || !therapistId) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
      });
    }

    // Check if conversation already exists
    const existingQuery = `
      SELECT id FROM conversations
      WHERE patient_id = $1 AND therapist_id = $2
        AND (conversation_type IS NULL OR conversation_type = 'regular')
    `;

    const existingResult = await new Promise((resolve, reject) => {
      db.query(existingQuery, [patientId, therapistId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (existingResult.rows && existingResult.rows.length > 0) {
      return res.json({
        success: true,
        conversationId: existingResult.rows[0].id,
        message: "Conversation already exists",
      });
    }

    // Create new conversation
    const conversationId = uuidv4();
    const createQuery = `
      INSERT INTO conversations (
        id, patient_id, therapist_id, conversation_type, status,
        created_at, updated_at
      ) VALUES ($1, $2, $3, 'regular', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    const result = await new Promise((resolve, reject) => {
      db.query(
        createQuery,
        [conversationId, patientId, therapistId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    res.json({
      success: true,
      conversationId: result.rows[0].id,
      message: "Conversation created successfully",
    });
  } catch (error) {
    console.error("Error starting conversation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start conversation",
    });
  }
};

// Get user's conversations - Works for patients, therapists, AND admins
exports.getConversations = async (req, res) => {
  const userId = req.session.user.id;
  const userRole = req.session.user.role;

  try {
    console.log("Loading conversations for user:", userId, "role:", userRole);

    // ADMIN: Get admin conversations
    if (userRole === "admin") {
      const query = `
        SELECT c.*,
               u.name as participant_name,
               u.email as participant_email,
               u.role as participant_role,
               ta.profile_image as participant_image,
               ta.specialty as participant_specialty,
               m.content as last_message,
               m.created_at as last_message_time,
               COUNT(CASE WHEN m2.is_read = false AND m2.sender_id != $1 THEN 1 END) as unread_count
        FROM conversations c
        JOIN users u ON c.patient_id = u.id
        LEFT JOIN therapist_applications ta ON u.id = ta.user_id
        LEFT JOIN messages m ON c.id = m.conversation_id 
          AND m.created_at = (SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id)
        LEFT JOIN messages m2 ON c.id = m2.conversation_id
        WHERE c.therapist_id = $1 
          AND c.conversation_type = 'admin'
          AND (c.status IS NULL OR c.status = 'active')
        GROUP BY c.id, u.name, u.email, u.role, ta.profile_image, ta.specialty, m.content, m.created_at
        ORDER BY COALESCE(m.created_at, c.created_at) DESC
      `;

      const result = await new Promise((resolve, reject) => {
        db.query(query, [userId], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      const formattedConversations = (result.rows || []).map((conv) => ({
        id: conv.id,
        conversation_type: "admin",
        other_user: {
          id: conv.patient_id,
          name: conv.participant_name,
          role: conv.participant_role,
          image: conv.participant_image,
          specialty:
            conv.participant_role === "therapist"
              ? conv.participant_specialty || "Therapist"
              : "Patient",
        },
        last_message: conv.last_message,
        last_message_time: conv.last_message_time,
        unread_count: parseInt(conv.unread_count) || 0,
        created_at: conv.created_at,
      }));

      return res.json({
        success: true,
        conversations: formattedConversations,
      });
    }

    // PATIENT/THERAPIST: Get both regular AND admin conversations
    const query = `
      SELECT c.*,
             CASE
               WHEN c.patient_id = $1 AND c.conversation_type = 'admin' THEN ut.name
               WHEN c.patient_id = $1 THEN ut.name
               WHEN c.therapist_id = $1 THEN up.name
             END as other_user_name,
             CASE
               WHEN c.patient_id = $1 AND c.conversation_type = 'admin' THEN ut.id
               WHEN c.patient_id = $1 THEN ut.id
               WHEN c.therapist_id = $1 THEN up.id
             END as other_user_id,
             CASE
               WHEN c.patient_id = $1 AND c.conversation_type = 'admin' THEN 'admin'
               WHEN c.patient_id = $1 THEN 'therapist'
               WHEN c.therapist_id = $1 THEN 'patient'
             END as other_user_role,
             ta.profile_image as therapist_image,
             ta.specialty as therapist_specialty,
             m.content as last_message,
             m.created_at as last_message_time,
             COUNT(CASE WHEN m2.is_read = false AND m2.sender_id != $1 THEN 1 END) as unread_count
      FROM conversations c
      JOIN users up ON c.patient_id = up.id
      JOIN users ut ON c.therapist_id = ut.id
      LEFT JOIN therapist_applications ta ON ut.id = ta.user_id
      LEFT JOIN messages m ON c.id = m.conversation_id
        AND m.created_at = (SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id)
      LEFT JOIN messages m2 ON c.id = m2.conversation_id
      WHERE (c.patient_id = $1 OR c.therapist_id = $1)
      GROUP BY c.id, up.name, up.id, ut.name, ut.id,
               ta.profile_image, ta.specialty, m.content, m.created_at
      ORDER BY COALESCE(m.created_at, c.created_at) DESC
    `;

    const result = await new Promise((resolve, reject) => {
      db.query(query, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    const formattedConversations = (result.rows || []).map((conv) => {
      const isPatient = conv.patient_id === userId;

      return {
        id: conv.id,
        conversation_type: conv.conversation_type || "regular",
        other_user: {
          id: conv.other_user_id,
          name: conv.other_user_name,
          role: conv.other_user_role,
          image: isPatient ? conv.therapist_image : null,
          specialty: isPatient
            ? conv.therapist_specialty || "General Practice"
            : "Patient",
        },
        last_message: conv.last_message,
        last_message_time: conv.last_message_time,
        unread_count: parseInt(conv.unread_count) || 0,
        created_at: conv.created_at,
      };
    });

    res.json({
      success: true,
      conversations: formattedConversations,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch conversations",
    });
  }
};

// Get messages for a conversation - Works for all user types
exports.getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.session.user.id;
  const userRole = req.session.user.role;

  try {
    console.log(
      "Getting messages for conversation:",
      conversationId,
      "user:",
      userId,
      "role:",
      userRole
    );

    // FIXED QUERY: Get proper profile images for both patient and therapist
    const verifyQuery = `
      SELECT c.*,
             up.name as patient_name,
             up.email as patient_email,
             up.id as patient_id,
             up.profile_image as patient_profile_image,
             ut.name as therapist_name,
             ut.email as therapist_email,
             ut.id as therapist_id,
             ut.profile_image as therapist_user_profile_image,
             ta.profile_image as therapist_app_profile_image,
             ta.specialty as therapist_specialty
      FROM conversations c
      JOIN users up ON c.patient_id = up.id
      JOIN users ut ON c.therapist_id = ut.id
      LEFT JOIN therapist_applications ta ON ut.id = ta.user_id
      WHERE c.id = $1 AND (c.patient_id = $2 OR c.therapist_id = $2)
    `;

    const verifyResult = await new Promise((resolve, reject) => {
      db.query(verifyQuery, [conversationId, userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (!verifyResult.rows || verifyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found or access denied",
      });
    }

    const conversation = verifyResult.rows[0];

    // Get messages with sender profile images (including patient images!)
    const messagesQuery = `
      SELECT m.*,
             u.name as sender_name,
             u.role as sender_role,
             u.profile_image as sender_user_profile_image,
             ta.profile_image as sender_therapist_profile_image
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN therapist_applications ta ON u.id = ta.user_id AND u.role = 'therapist'
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `;

    const messagesResult = await new Promise((resolve, reject) => {
      db.query(messagesQuery, [conversationId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    // Mark messages as read
    await new Promise((resolve, reject) => {
      db.query(
        "UPDATE messages SET is_read = true WHERE conversation_id = $1 AND sender_id != $2",
        [conversationId, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Determine other user based on role
    let otherUser;
    const isAdmin = conversation.conversation_type === "admin";

    if (isAdmin && userRole === "admin") {
      // Admin viewing conversation with patient/therapist
      const participantRole = conversation.patient_id === userId ? "therapist" : "patient";
      const participantImage = participantRole === "therapist"
        ? (conversation.therapist_app_profile_image || conversation.therapist_user_profile_image)
        : conversation.patient_profile_image;

      otherUser = {
        id: participantRole === "therapist" ? conversation.therapist_id : conversation.patient_id,
        name: participantRole === "therapist" ? conversation.therapist_name : conversation.patient_name,
        role: participantRole,
        image: participantImage,
        specialty: participantRole === "therapist"
          ? (conversation.therapist_specialty || "Therapist")
          : "Patient",
      };
    } else if (isAdmin) {
      // Patient/Therapist viewing admin conversation
      otherUser = {
        id: conversation.therapist_id,
        name: "Admin Support",
        role: "admin",
        image: null,
        specialty: "Admin Support",
      };
    } else {
      // Regular patient-therapist conversation
      const isPatient = conversation.patient_id === userId;

      if (isPatient) {
        // Patient viewing - show therapist with proper image
        // FIXED: Use the correct image field - therapist_app_profile_image takes precedence
        const therapistImage = conversation.therapist_app_profile_image ||
                              conversation.therapist_user_profile_image ||
                              conversation.patient_profile_image; // fallback

        console.log("🔍 PATIENT VIEW - Therapist image selection:", {
          therapist_app_profile_image: conversation.therapist_app_profile_image,
          therapist_user_profile_image: conversation.therapist_user_profile_image,
          patient_profile_image: conversation.patient_profile_image,
          selected_image: therapistImage
        });

        otherUser = {
          id: conversation.therapist_id,
          name: conversation.therapist_name,
          role: "therapist",
          image: therapistImage ? `/uploads/profiles/${therapistImage}` : null,
          specialty: conversation.therapist_specialty || "General Practice",
        };
      } else {
        // Therapist viewing - show patient with proper image
        otherUser = {
          id: conversation.patient_id,
          name: conversation.patient_name,
          role: "patient",
          image: conversation.patient_profile_image, // FIXED: Now includes patient image!
          specialty: "Patient",
        };
      }
    }

    console.log("🔍 PATIENT VIEW DEBUG - Other user info:", {
      id: otherUser.id,
      name: otherUser.name,
      role: otherUser.role,
      image: otherUser.image,
      therapist_app_profile_image: conversation.therapist_app_profile_image,
      therapist_user_profile_image: conversation.therapist_user_profile_image,
      isPatient: conversation.patient_id === userId,
      currentUserId: userId,
      currentUserRole: userRole
    });

    res.json({
      success: true,
      conversation: {
        id: conversation.id,
        patient_id: conversation.patient_id,
        therapist_id: conversation.therapist_id,
        conversation_type: conversation.conversation_type,
        patient_name: conversation.patient_name,
        therapist_name: conversation.therapist_name,
        therapist_image: conversation.therapist_app_profile_image || conversation.therapist_user_profile_image,
        patient_image: conversation.patient_profile_image,
        specialty: conversation.therapist_specialty,
        other_user: otherUser, // Include the complete other_user object!
      },
      messages: messagesResult.rows || [],
      isAdminConversation: isAdmin,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch messages",
    });
  }
};

// Send message - FIXED to work with patient_id/therapist_id
exports.sendMessage = async (req, res) => {
  const { conversationId } = req.params;
  const { content } = req.body;
  const userId = req.session?.user?.id;
  const userName = req.session?.user?.name;
  const userRole = req.session?.user?.role;

  try {
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Message content is required",
      });
    }

    // FIXED: Verify using patient_id/therapist_id
    const verifyQuery = `
      SELECT c.*, 
             up.name as patient_name, 
             ut.name as therapist_name
      FROM conversations c
      JOIN users up ON c.patient_id = up.id
      JOIN users ut ON c.therapist_id = ut.id
      WHERE c.id = $1 
        AND (c.patient_id = $2 OR c.therapist_id = $2) 
        AND (c.status IS NULL OR c.status = 'active')
    `;

    const verifyResult = await new Promise((resolve, reject) => {
      db.query(verifyQuery, [conversationId, userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (!verifyResult.rows || verifyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found or access denied",
      });
    }

    const conversation = verifyResult.rows[0];

    // Insert message
    const messageQuery = `
      INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at)
      VALUES ($1, $2, $3, 'text', CURRENT_TIMESTAMP)
      RETURNING id, created_at
    `;

    const messageResult = await new Promise((resolve, reject) => {
      db.query(
        messageQuery,
        [conversationId, userId, content.trim()],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    // Update conversation timestamp
    await new Promise((resolve, reject) => {
      db.query(
        "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [conversationId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Get other participant ID
    const otherUserId =
      conversation.patient_id === userId
        ? conversation.therapist_id
        : conversation.patient_id;

    // Create notification
    await createNotification(
      otherUserId,
      conversation.conversation_type === "admin"
        ? "admin_message"
        : "new_message",
      userRole === "admin" ? "New Message from Admin" : "New Message",
      `${userName} sent you a message`,
      { conversationId: conversationId }
    );

    // Emit real-time message via socket
    const io = req.app?.get("io");
    if (io) {
      io.to(conversationId).emit("new_message", {
        id: messageResult.rows[0].id,
        conversationId: conversationId,
        senderId: userId,
        content: content.trim(),
        messageType: "text",
        createdAt: messageResult.rows[0].created_at,
        senderName: userName,
        senderRole: userRole,
      });
    }

    res.json({
      success: true,
      message: {
        id: messageResult.rows[0].id,
        conversation_id: conversationId,
        sender_id: userId,
        content: content.trim(),
        message_type: "text",
        created_at: messageResult.rows[0].created_at,
        sender_name: userName,
        sender_role: userRole,
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send message",
    });
  }
};

// Export the upload middleware for use in routes
exports.upload = upload;

// Helper function
async function createNotification(userId, type, title, message, data = {}) {
  try {
    const query = `
      INSERT INTO notifications (user_id, type, title, message, data, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    await new Promise((resolve, reject) => {
      db.query(
        query,
        [userId, type, title, message, JSON.stringify(data)],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}
