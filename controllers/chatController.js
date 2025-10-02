// controllers/chatController.js - COMPLETE FIXED VERSION with Admin Support
const db = require("../config/database");
const { v4: uuidv4 } = require("uuid");

// Add this to the end of chatController.js, before the createNotification function

// Start a new conversation
exports.startConversation = async (req, res) => {
  const userId = req.session.user.id;
  const userRole = req.session.user.role;

  try {
    console.log('Starting conversation for user:', userId, 'role:', userRole);

    let patientId, therapistId;

    if (userRole === 'patient') {
      patientId = userId;
      therapistId = req.body.therapistId;
    } else if (userRole === 'therapist') {
      patientId = req.body.patientId;
      therapistId = userId;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid user role for starting conversation'
      });
    }

    if (!patientId || !therapistId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
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
        message: 'Conversation already exists'
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
      db.query(createQuery, [conversationId, patientId, therapistId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    res.json({
      success: true,
      conversationId: result.rows[0].id,
      message: 'Conversation created successfully'
    });

  } catch (error) {
    console.error('Error starting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start conversation'
    });
  }
};

// Get user's conversations - Works for patients, therapists, AND admins
exports.getConversations = async (req, res) => {
  const userId = req.session.user.id;
  const userRole = req.session.user.role;

  try {
    console.log('Loading conversations for user:', userId, 'role:', userRole);

    // ADMIN: Get admin conversations
    if (userRole === 'admin') {
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

      const formattedConversations = (result.rows || []).map(conv => ({
        id: conv.id,
        conversation_type: 'admin',
        other_user: {
          id: conv.patient_id,
          name: conv.participant_name,
          role: conv.participant_role,
          image: conv.participant_image,
          specialty: conv.participant_role === 'therapist' ? 
            (conv.participant_specialty || 'Therapist') : 'Patient'
        },
        last_message: conv.last_message,
        last_message_time: conv.last_message_time,
        unread_count: parseInt(conv.unread_count) || 0,
        created_at: conv.created_at
      }));

      return res.json({
        success: true,
        conversations: formattedConversations
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

    const formattedConversations = (result.rows || []).map(conv => {
      const isPatient = conv.patient_id === userId;
      
      return {
        id: conv.id,
        conversation_type: conv.conversation_type || 'regular',
        other_user: {
          id: conv.other_user_id,
          name: conv.other_user_name,
          role: conv.other_user_role,
          image: isPatient ? conv.therapist_image : null,
          specialty: isPatient ? (conv.therapist_specialty || 'General Practice') : 'Patient'
        },
        last_message: conv.last_message,
        last_message_time: conv.last_message_time,
        unread_count: parseInt(conv.unread_count) || 0,
        created_at: conv.created_at
      };
    });

    res.json({
      success: true,
      conversations: formattedConversations
    });

  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch conversations"
    });
  }
};

// Get messages for a conversation - Works for all user types
exports.getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.session.user.id;
  const userRole = req.session.user.role;

  try {
    console.log('Getting messages for conversation:', conversationId, 'user:', userId, 'role:', userRole);

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
        error: "Conversation not found or access denied"
      });
    }

    const conversation = verifyResult.rows[0];

    // Get messages
    const messagesQuery = `
      SELECT m.*, u.name as sender_name, u.role as sender_role,
             CASE 
               WHEN u.role = 'therapist' THEN ta.profile_image
               ELSE null
             END as sender_image
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
    const isAdmin = conversation.conversation_type === 'admin';

    if (isAdmin && userRole === 'admin') {
      // Admin viewing conversation with patient/therapist
      otherUser = {
        id: conversation.patient_id,
        name: conversation.patient_name,
        role: conversation.patient_role, // ← FIXED: Use actual role from database
        image: conversation.patient_role === 'therapist' ? conversation.therapist_image : null,
        specialty: conversation.patient_role === 'therapist' ?
          (conversation.therapist_specialty || 'Therapist') : 'Patient'
      };
    } else if (isAdmin) {
      // Patient/Therapist viewing admin conversation
      otherUser = {
        id: conversation.therapist_id,
        name: conversation.therapist_name,
        role: 'admin',
        image: null,
        specialty: 'Admin Support'
      };
    } else {
      // Regular patient-therapist conversation
      const isPatient = conversation.patient_id === userId;
      otherUser = isPatient ? {
        id: conversation.therapist_id,
        name: conversation.therapist_name,
        role: 'therapist',
        image: conversation.therapist_image,
        specialty: conversation.therapist_specialty || 'General Practice'
      } : {
        id: conversation.patient_id,
        name: conversation.patient_name,
        role: 'patient',
        image: null,
        specialty: null
      };
    }

    res.json({
      success: true,
      conversation: {
        id: conversation.id,
        patient_id: conversation.patient_id,
        therapist_id: conversation.therapist_id,
        conversation_type: conversation.conversation_type,
        other_user: otherUser
      },
      messages: messagesResult.rows || [],
      isAdminConversation: isAdmin
    });

  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch messages"
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
        error: "Message content is required"
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
        error: "Conversation not found or access denied"
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
      db.query(messageQuery, [conversationId, userId, content.trim()], (err, results) => {
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

    // Get other participant ID
    const otherUserId = conversation.patient_id === userId ? 
      conversation.therapist_id : conversation.patient_id;

    // Create notification
    await createNotification(
      otherUserId,
      conversation.conversation_type === 'admin' ? 'admin_message' : 'new_message',
      userRole === 'admin' ? 'New Message from Admin' : 'New Message',
      `${userName} sent you a message`,
      { conversationId: conversationId }
    );

    // Emit real-time message via socket
    const io = req.app?.get('io');
    if (io) {
      io.to(conversationId).emit('new_message', {
        id: messageResult.rows[0].id,
        conversationId: conversationId,
        senderId: userId,
        content: content.trim(),
        messageType: 'text',
        createdAt: messageResult.rows[0].created_at,
        senderName: userName,
        senderRole: userRole
      });
    }

    res.json({
      success: true,
      message: {
        id: messageResult.rows[0].id,
        conversation_id: conversationId,
        sender_id: userId,
        content: content.trim(),
        message_type: 'text',
        created_at: messageResult.rows[0].created_at,
        sender_name: userName,
        sender_role: userRole
      }
    });

  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send message"
    });
  }
};

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