// controllers/chatController.js - Fixed with better error handling and notifications
const db = require("../config/database");
const { v4: uuidv4 } = require("uuid");

// Start a new conversation
exports.startConversation = async (req, res) => {
  const userId = req.session.user.id;
  const userRole = req.session.user.role;
  let otherId, otherRole, initiatorRole;

  try {
    console.log('Starting conversation for user', userId, 'role', userRole);

    if (userRole === 'patient') {
      otherId = req.body.therapistId;
      otherRole = 'therapist';
      initiatorRole = 'patient';
    } else if (userRole === 'therapist') {
      otherId = req.body.patientId;
      otherRole = 'patient';
      initiatorRole = 'therapist';
    } else {
      return res.status(403).json({
        success: false,
        error: "Invalid user role"
      });
    }

    if (!otherId) {
      return res.status(400).json({
        success: false,
        error: `${otherRole} ID is required`
      });
    }

    // Validate other user exists and has correct role
    let otherCheck;
    let otherResult;
    if (otherRole === 'therapist') {
      otherCheck = `
        SELECT u.id, u.name, u.email, ta.status,
               COALESCE(ta.specialty, 'General Practice') as specialty,
               ta.profile_image
        FROM users u
        LEFT JOIN therapist_applications ta ON u.id = ta.user_id
        WHERE u.id = $1 AND u.role = 'therapist' AND ta.status = 'approved'
      `;
    } else {
      otherCheck = `
        SELECT u.id, u.name, u.email
        FROM users u
        WHERE u.id = $1 AND u.role = 'patient'
      `;
    }

    otherResult = await new Promise((resolve, reject) => {
      db.query(otherCheck, [otherId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (!otherResult.rows || otherResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `${otherRole.charAt(0).toUpperCase() + otherRole.slice(1)} not found or not available`,
      });
    }

    const otherUser = otherResult.rows[0];

    // Determine patient_id and therapist_id
    let patientId, therapistId;
    if (initiatorRole === 'patient') {
      patientId = userId;
      therapistId = otherId;
    } else {
      patientId = otherId;
      therapistId = userId;
    }

    // Check if conversation already exists
    const existingConversation = `
      SELECT id FROM conversations
      WHERE patient_id = $1 AND therapist_id = $2 AND status = 'active'
    `;

    const existingResult = await new Promise((resolve, reject) => {
      db.query(
        existingConversation,
        [patientId, therapistId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    if (existingResult.rows && existingResult.rows.length > 0) {
      return res.json({
        success: true,
        conversationId: existingResult.rows[0].id,
        message: "Existing conversation found",
      });
    }

    // Create new conversation
    const conversationId = uuidv4();
    const createConversation = `
      INSERT INTO conversations (id, patient_id, therapist_id, status, created_at, updated_at)
      VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    await new Promise((resolve, reject) => {
      db.query(
        createConversation,
        [conversationId, patientId, therapistId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    // Send welcome message only if patient is initiating
    if (initiatorRole === 'patient') {
      const welcomeMessage = `
        INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at)
        VALUES ($1, $2, $3, 'system', CURRENT_TIMESTAMP)
      `;

      await new Promise((resolve, reject) => {
        db.query(
          welcomeMessage,
          [
            conversationId,
            therapistId,
            `Hello! I'm ${otherUser.name}. I'm here to help you on your mental health journey. Feel free to share what's on your mind.`,
          ],
          (err, results) => {
            if (err) reject(err);
            else resolve(results);
          }
        );
      });

      // Create notification for therapist
      await createNotification(
        therapistId,
        "new_conversation",
        "New Chat Started",
        `${req.session.user.name} has started a conversation with you.`,
        { conversationId: conversationId }
      );

      // Create notification for patient
      await createNotification(
        patientId,
        "conversation_started",
        "Conversation Started",
        `Your conversation with ${otherUser.name} has been started. They've sent you a welcome message.`,
        { conversationId: conversationId }
      );
    } else {
      // Therapist initiating - no welcome message, just notify patient
      await createNotification(
        patientId,
        "new_conversation",
        "Therapist Message",
        `${req.session.user.name} would like to discuss your progress.`,
        { conversationId: conversationId }
      );
    }

    res.json({
      success: true,
      conversationId: conversationId,
      message: "Conversation started successfully",
    });
  } catch (error) {
    console.error("Error starting conversation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start conversation",
    });
  }
};

// Get user's conversations
exports.getConversations = async (req, res) => {
  const userId = req.session.user.id;
  const userRole = req.session.user.role;

  try {
    console.log('Loading conversations for user:', userId, 'role:', userRole);

    let query;
    if (userRole === "therapist") {
      query = `
        SELECT c.*, 
               u.name as patient_name,
               u.email as patient_email,
               u.profile_image as patient_image,
               m.content as last_message,
               m.created_at as last_message_time,
               COUNT(CASE WHEN m2.is_read = false AND m2.sender_id != $1 THEN 1 END) as unread_count
        FROM conversations c
        JOIN users u ON c.patient_id = u.id
        LEFT JOIN messages m ON c.id = m.conversation_id 
            AND m.created_at = (
                SELECT MAX(created_at) 
                FROM messages 
                WHERE conversation_id = c.id
            )
        LEFT JOIN messages m2 ON c.id = m2.conversation_id
        WHERE c.therapist_id = $1 AND c.status = 'active'
        GROUP BY c.id, u.name, u.email, u.profile_image, m.content, m.created_at
        ORDER BY COALESCE(m.created_at, c.created_at) DESC
      `;
    } else {
      query = `
        SELECT c.*, 
               u.name as therapist_name,
               u.email as therapist_email,
               ta.profile_image as therapist_image,
               COALESCE(ta.specialty, 'General Practice') as specialty,
               m.content as last_message,
               m.created_at as last_message_time,
               COUNT(CASE WHEN m2.is_read = false AND m2.sender_id != $1 THEN 1 END) as unread_count
        FROM conversations c
        JOIN users u ON c.therapist_id = u.id
        LEFT JOIN therapist_applications ta ON u.id = ta.user_id
        LEFT JOIN messages m ON c.id = m.conversation_id 
            AND m.created_at = (
                SELECT MAX(created_at) 
                FROM messages 
                WHERE conversation_id = c.id
            )
        LEFT JOIN messages m2 ON c.id = m2.conversation_id
        WHERE c.patient_id = $1 AND c.status = 'active'
        GROUP BY c.id, u.name, u.email, ta.profile_image, ta.specialty, m.content, m.created_at
        ORDER BY COALESCE(m.created_at, c.created_at) DESC
      `;
    }

    const result = await new Promise((resolve, reject) => {
      db.query(query, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    console.log('Found conversations:', result.rows?.length || 0);

    res.json({
      success: true,
      conversations: result.rows || [],
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch conversations",
    });
  }
};

// Get messages for a conversation
exports.getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.session.user.id;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  try {
    console.log('Getting messages for conversation:', conversationId, 'user:', userId);

    // Verify user is part of this conversation
    const verifyQuery = `
      SELECT c.*, 
             p.name as patient_name, p.profile_image as patient_image,
             t.name as therapist_name,
             ta.profile_image as therapist_image, 
             COALESCE(ta.specialty, 'General Practice') as specialty
      FROM conversations c
      JOIN users p ON c.patient_id = p.id
      JOIN users t ON c.therapist_id = t.id
      LEFT JOIN therapist_applications ta ON t.id = ta.user_id
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

    // Get messages
    const messagesQuery = `
      SELECT m.*, 
             u.name as sender_name,
             CASE 
                 WHEN u.id = c.patient_id THEN p.profile_image
                 ELSE ta.profile_image
             END as display_image
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN users p ON c.patient_id = p.id
      LEFT JOIN therapist_applications ta ON c.therapist_id = ta.user_id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2 OFFSET $3
    `;

    const messagesResult = await new Promise((resolve, reject) => {
      db.query(
        messagesQuery,
        [conversationId, limit, offset],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    // Mark messages as read for the current user
    await new Promise((resolve, reject) => {
      db.query(
        "UPDATE messages SET is_read = true WHERE conversation_id = $1 AND sender_id != $2",
        [conversationId, userId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    console.log('Retrieved messages:', messagesResult.rows?.length || 0);

    res.json({
      success: true,
      conversation: conversation,
      messages: messagesResult.rows || [],
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch messages",
    });
  }
};

// Send a message
exports.sendMessage = async (req, res) => {
  const { conversationId } = req.params;
  const { content } = req.body;
  const senderId = req.session.user.id;

  try {
    console.log('Sending message from user:', senderId, 'to conversation:', conversationId);

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Message content cannot be empty",
      });
    }

    // Verify conversation exists and user is part of it
    const verifyQuery = `
      SELECT c.*, p.name as patient_name, t.name as therapist_name
      FROM conversations c
      JOIN users p ON c.patient_id = p.id
      JOIN users t ON c.therapist_id = t.id
      WHERE c.id = $1 AND (c.patient_id = $2 OR c.therapist_id = $2) AND c.status = 'active'
    `;

    const verifyResult = await new Promise((resolve, reject) => {
      db.query(verifyQuery, [conversationId, senderId], (err, results) => {
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
      INSERT INTO messages (conversation_id, sender_id, content, message_type, is_read, created_at)
      VALUES ($1, $2, $3, 'text', false, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await new Promise((resolve, reject) => {
      db.query(
        messageQuery,
        [conversationId, senderId, content.trim()],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    const message = result.rows[0];

    // Update conversation timestamp
    await new Promise((resolve, reject) => {
      db.query(
        "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [conversationId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    // Notify the other party
    const recipientId = senderId === conversation.patient_id ? 
      conversation.therapist_id : conversation.patient_id;
    
    const senderName = senderId === conversation.patient_id ? 
      conversation.patient_name : conversation.therapist_name;

    console.log('Notifying recipient:', recipientId, 'from sender:', senderName);

    await createNotification(
      recipientId,
      "new_message",
      "New Message",
      `You have a new message from ${senderName}`,
      { 
        conversationId: conversationId, 
        messageId: message.id,
        messagePreview: content.trim().substring(0, 50) + (content.trim().length > 50 ? '...' : '')
      }
    );

    res.json({
      success: true,
      message: message,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send message",
    });
  }
};

// Start video call
exports.startVideoCall = async (req, res) => {
  const { conversationId } = req.body;
  const userId = req.session.user.id;

  try {
    // Verify conversation
    const verifyQuery = `
      SELECT * FROM conversations 
      WHERE id = $1 AND (patient_id = $2 OR therapist_id = $2) AND status = 'active'
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
        error: "Conversation not found",
      });
    }

    const conversation = verifyResult.rows[0];
    const roomId = uuidv4();
    const callId = uuidv4();

    // Create video call record
    const videoCallQuery = `
      INSERT INTO video_calls (id, conversation_id, room_id, initiated_by, status, created_at)
      VALUES ($1, $2, $3, $4, 'active', CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const callResult = await new Promise((resolve, reject) => {
      db.query(
        videoCallQuery,
        [callId, conversationId, roomId, userId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    // Notify the other party
    const otherUserId = userId === conversation.patient_id ? 
      conversation.therapist_id : conversation.patient_id;

    await createNotification(
      otherUserId,
      "video_call_request",
      "Video Call Request",
      `${req.session.user.name} is requesting a video call`,
      { conversationId: conversationId, roomId: roomId }
    );

    res.json({
      success: true,
      videoCall: callResult.rows[0],
      roomId: roomId,
    });
  } catch (error) {
    console.error("Error starting video call:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start video call",
    });
  }
};

// Join video call
exports.joinVideoCall = async (req, res) => {
  const { videoCallId } = req.params;

  try {
    // Update video call status
    const updateQuery = `
      UPDATE video_calls 
      SET status = 'in_progress', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await new Promise((resolve, reject) => {
      db.query(updateQuery, [videoCallId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    res.json({
      success: true,
      videoCall: result.rows[0],
    });
  } catch (error) {
    console.error("Error joining video call:", error);
    res.status(500).json({
      success: false,
      error: "Failed to join video call",
    });
  }
};

// End video call
exports.endVideoCall = async (req, res) => {
  const { videoCallId } = req.params;

  try {
    const updateQuery = `
      UPDATE video_calls 
      SET status = 'ended', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
          duration = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(started_at, created_at)))
      WHERE id = $1
      RETURNING *
    `;

    const result = await new Promise((resolve, reject) => {
      db.query(updateQuery, [videoCallId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    res.json({
      success: true,
      videoCall: result.rows[0],
    });
  } catch (error) {
    console.error("Error ending video call:", error);
    res.status(500).json({
      success: false,
      error: "Failed to end video call",
    });
  }
};

// Helper function to create notifications
async function createNotification(userId, type, title, message, data = {}) {
  const query = `
    INSERT INTO notifications (user_id, type, title, message, data, created_at)
    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    RETURNING id
  `;

  try {
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
    console.log('Notification created for user:', userId, 'type:', type);
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}