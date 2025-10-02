const db = require("../config/database");

// Helper function to detect table structure
async function detectTableStructure() {
  try {
    const convColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'conversations'
      ORDER BY ordinal_position
    `;
    const convResult = await db.query(convColumnsQuery);
    const conversationColumns = convResult.rows.map(row => row.column_name);
    
    const msgColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages'
      ORDER BY ordinal_position
    `;
    const msgResult = await db.query(msgColumnsQuery);
    const messageColumns = msgResult.rows.map(row => row.column_name);
    
    console.log('Detected conversation columns:', conversationColumns);
    console.log('Detected message columns:', messageColumns);
    
    return {
      conversations: conversationColumns,
      messages: messageColumns,
      hasPatientId: conversationColumns.includes('patient_id'),
      hasTherapistId: conversationColumns.includes('therapist_id'),
      hasParticipants: conversationColumns.includes('participant1_id'),
      hasConversationType: conversationColumns.includes('conversation_type')
    };
  } catch (error) {
    console.error('Error detecting table structure:', error);
    return {
      conversations: [],
      messages: [],
      hasPatientId: false,
      hasTherapistId: false,
      hasParticipants: false,
      hasConversationType: false
    };
  }
}

// In adminController.js - Fix the startConversationWith function

exports.startConversationWith = async (req, res) => {
  const { participantId, participantType, message } = req.body;
  const adminId = parseInt(req.session.user.id);

  try {
    console.log('Admin starting conversation:', { adminId, participantId, participantType });
    
    const tableStructure = await detectTableStructure();
    const participantIdInt = parseInt(participantId);

    // Validate other user exists
    const otherUserQuery = `SELECT id, name, email, role FROM users WHERE id = $1 AND role = $2`;
    const otherUserResult = await db.query(otherUserQuery, [participantIdInt, participantType]);

    if (!otherUserResult.rows || otherUserResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `${participantType.charAt(0).toUpperCase() + participantType.slice(1)} not found`
      });
    }

    let conversationId;
    
    // FIXED: Always put admin as therapist_id and other user as patient_id for admin conversations
    if (tableStructure.hasPatientId && tableStructure.hasTherapistId) {
      // Check for existing conversation (admin conversations stored with admin as therapist)
      const existingConvQuery = `
        SELECT id FROM conversations
        WHERE patient_id = $1 AND therapist_id = $2
        AND conversation_type = 'admin'
        AND (status IS NULL OR status = 'active')
      `;
      
      const existingResult = await db.query(existingConvQuery, [participantIdInt, adminId]);
      
      if (existingResult.rows && existingResult.rows.length > 0) {
        conversationId = existingResult.rows[0].id;
        console.log('Found existing admin conversation:', conversationId);
      } else {
        // Create new conversation with admin as therapist, other user as patient
        const createQuery = `
          INSERT INTO conversations (
            patient_id, therapist_id, conversation_type, status,
            created_at, updated_at
          ) VALUES ($1, $2, 'admin', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id
        `;
        
        const convResult = await db.query(createQuery, [participantIdInt, adminId]);
        conversationId = convResult.rows[0].id;
        console.log('Created new admin conversation:', conversationId);
      }
    } else if (tableStructure.hasParticipants) {
      // Use participant structure (fallback)
      const existingConvQuery = `
        SELECT id FROM conversations
        WHERE ((participant1_id = $1 AND participant2_id = $2) OR
               (participant1_id = $2 AND participant2_id = $1))
        AND conversation_type = 'admin'
        AND status = 'active'
      `;
      
      const existingResult = await db.query(existingConvQuery, [adminId, participantIdInt]);
      
      if (existingResult.rows && existingResult.rows.length > 0) {
        conversationId = existingResult.rows[0].id;
      } else {
        const createQuery = `
          INSERT INTO conversations (
            participant1_id, participant2_id,
            participant1_role, participant2_role, conversation_type,
            status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, 'admin', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id
        `;
        
        const convResult = await db.query(createQuery, [adminId, participantIdInt, 'admin', participantType]);
        conversationId = convResult.rows[0].id;
      }
    }

    // Send initial message if provided
    if (message && message.trim()) {
      const messageQuery = `
        INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at)
        VALUES ($1, $2, $3, 'text', CURRENT_TIMESTAMP)
        RETURNING id, created_at
      `;

      await db.query(messageQuery, [conversationId, adminId, message.trim()]);
      console.log('Initial message sent in conversation:', conversationId);
    }

    // Create notification
    await createNotification(
      participantIdInt,
      'admin_conversation',
      'Message from Admin',
      message ? message : `An admin has started a conversation with you`,
      { conversationId: conversationId }
    );

    res.json({
      success: true,
      conversationId: conversationId,
      message: "Conversation started successfully"
    });

  } catch (error) {
    console.error("Error starting admin conversation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start conversation"
    });
  }
};

exports.getAdminConversations = async (req, res) => {
  const adminId = parseInt(req.session.user.id);

  try {
    console.log('Loading admin conversations for admin:', adminId);

    // Use the dedicated admin_conversations table
    const query = `
      SELECT ac.*,
             u.name as participant_name,
             u.email as participant_email,
             u.role as participant_role,
             u.profile_image as participant_image,
             ta.profile_image as therapist_image,
             ta.specialty as participant_specialty,
             am.content as last_message,
             am.created_at as last_message_time,
             (SELECT COUNT(*) FROM admin_messages
              WHERE conversation_id = ac.id AND is_read = FALSE AND sender_id != ac.admin_id) as unread_count
      FROM admin_conversations ac
      JOIN users u ON ac.participant_id = u.id
      LEFT JOIN therapist_applications ta ON u.id = ta.user_id AND u.role = 'therapist'
      LEFT JOIN admin_messages am ON ac.id = am.conversation_id
        AND am.created_at = (SELECT MAX(created_at) FROM admin_messages WHERE conversation_id = ac.id)
      WHERE ac.admin_id = $1
        AND ac.status = 'active'
      ORDER BY COALESCE(am.created_at, ac.created_at) DESC
    `;

    const result = await db.query(query, [adminId]);

    const formattedConversations = (result.rows || []).map(conv => ({
      id: conv.id,
      conversation_type: 'admin',
      other_user: {
        id: conv.participant_id,
        name: conv.participant_name,
        role: conv.participant_role,
        image: conv.participant_role === 'therapist' ? conv.therapist_image : conv.participant_image,
        specialty: conv.participant_role === 'therapist' ?
          (conv.participant_specialty || 'Therapist') : 'Patient'
      },
      last_message: conv.last_message,
      last_message_time: conv.last_message_time,
      unread_count: parseInt(conv.unread_count) || 0,
      created_at: conv.created_at
    }));

    res.json({
      success: true,
      conversations: formattedConversations
    });

  } catch (error) {
    console.error("Error fetching admin conversations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch conversations"
    });
  }
};

// Submit patient concern (works with new table)
exports.submitPatientConcern = async (req, res) => {
  try {
    const adminId = parseInt(req.session.user.id);
    const { patientId, concernType, severity, title, description } = req.body;

    if (!patientId || !concernType || !severity || !title || !description) {
      return res.status(400).json({
        success: false,
        error: "All fields are required"
      });
    }

    const patientIdInt = parseInt(patientId);
    
    // Verify patient exists
    const patientCheck = await db.query('SELECT id, name FROM users WHERE id = $1 AND role = $2', [patientIdInt, 'patient']);
    if (patientCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Patient not found"
      });
    }

    const insertQuery = `
      INSERT INTO patient_concerns 
      (patient_id, admin_id, concern_type, severity, title, description, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'open', CURRENT_TIMESTAMP)
      RETURNING id
    `;

    const result = await db.query(insertQuery, [patientIdInt, adminId, concernType, severity, title, description]);

    await createNotification(
      patientIdInt,
      'admin_concern',
      'Concern Submitted',
      `Admin has submitted a concern: ${title}`,
      { concernId: result.rows[0].id }
    );

    res.json({
      success: true,
      message: "Patient concern submitted successfully",
      concernId: result.rows[0].id
    });

  } catch (error) {
    console.error("Error submitting patient concern:", error);
    res.status(500).json({
      success: false,
      error: "Failed to submit patient concern"
    });
  }
};

// Send therapist contract (works with new table)
exports.sendTherapistContract = async (req, res) => {
  try {
    const adminId = parseInt(req.session.user.id);
    const { therapistId, contractType, title, content, requiresAcknowledgment, acknowledgmentDeadline } = req.body;

    if (!therapistId || !contractType || !title || !content) {
      return res.status(400).json({
        success: false,
        error: "All required fields must be provided"
      });
    }

    const therapistIdInt = parseInt(therapistId);
    
    const therapistCheck = await db.query('SELECT id, name FROM users WHERE id = $1 AND role = $2', [therapistIdInt, 'therapist']);
    if (therapistCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Therapist not found"
      });
    }

    const insertQuery = `
      INSERT INTO therapist_contracts 
      (therapist_id, admin_id, contract_type, title, content, 
       requires_acknowledgment, acknowledgment_deadline, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent', CURRENT_TIMESTAMP)
      RETURNING id
    `;

    const deadline = acknowledgmentDeadline ? new Date(acknowledgmentDeadline) : null;
    const result = await db.query(insertQuery, [
      therapistIdInt, adminId, contractType, title, content,
      requiresAcknowledgment || false, deadline
    ]);

    await createNotification(
      therapistIdInt,
      'therapist_contract',
      'New Contract Received',
      `You have received a new contract: ${title}`,
      { 
        contractId: result.rows[0].id,
        requiresAcknowledgment: requiresAcknowledgment,
        deadline: deadline
      }
    );

    res.json({
      success: true,
      message: "Contract sent to therapist successfully",
      contractId: result.rows[0].id
    });

  } catch (error) {
    console.error("Error sending therapist contract:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send therapist contract"
    });
  }
};

// Close admin conversation (adaptive)
exports.closeAdminConversation = async (req, res) => {
  try {
    const adminId = parseInt(req.session.user.id);
    const conversationId = req.params.conversationId; // Keep as string for UUID
    const { reason } = req.body;

    const tableStructure = await detectTableStructure();
    
    // Update conversation status in appropriate table
    let updateQuery, messageQuery, tableName;
    
    if (tableStructure.conversations.length > 0) {
      tableName = 'conversations';
      updateQuery = `
        UPDATE conversations 
        SET status = 'closed', 
            ${tableStructure.hasConversationType ? 'closure_reason = $2, closed_by = $3,' : ''}
            closed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      messageQuery = `
        INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at)
        VALUES ($1, $2, $3, 'system', CURRENT_TIMESTAMP)
      `;
    } else {
      tableName = 'conversations_admin';
      updateQuery = `
        UPDATE conversations_admin 
        SET status = 'closed', 
            closure_reason = $2,
            closed_by = $3,
            closed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      messageQuery = `
        INSERT INTO messages_admin (conversation_id, sender_id, content, message_type, created_at)
        VALUES ($1, $2, $3, 'system', CURRENT_TIMESTAMP)
      `;
    }

    if (tableStructure.hasConversationType || tableName === 'conversations_admin') {
      await db.query(updateQuery, [conversationId, reason || 'Admin closed', adminId]);
    } else {
      await db.query(`UPDATE ${tableName} SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [conversationId]);
    }

    const finalMessage = reason
      ? `This conversation has been closed by admin. Reason: ${reason}`
      : 'This conversation has been closed by admin.';

    await db.query(messageQuery, [conversationId, adminId, finalMessage]);

    res.json({
      success: true,
      message: "Conversation closed successfully"
    });

  } catch (error) {
    console.error("Error closing admin conversation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to close conversation"
    });
  }
};

// Send admin message (FIXED - uses admin_messages table)
exports.sendAdminMessage = async (req, res) => {
  const conversationId = req.params.conversationId;
  const { content } = req.body;
  const adminId = parseInt(req.session.user.id);

  try {
    console.log('Sending admin message:', { conversationId, adminId, contentLength: content?.length });

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Message content is required",
      });
    }

    // Verify conversation exists and admin has access (use admin_conversations table)
    const verifyQuery = `
      SELECT id FROM admin_conversations
      WHERE id = $1 AND admin_id = $2 AND status = 'active'
    `;
    const verifyResult = await db.query(verifyQuery, [conversationId, adminId]);

    if (!verifyResult.rows || verifyResult.rows.length === 0) {
      console.error('Conversation not found:', conversationId);
      return res.status(404).json({
        success: false,
        error: "Conversation not found"
      });
    }

    console.log('Conversation verified, inserting message...');

    // Insert message into admin_messages table
    const messageQuery = `
      INSERT INTO admin_messages (conversation_id, sender_id, content, message_type, created_at)
      VALUES ($1, $2, $3, 'text', CURRENT_TIMESTAMP)
      RETURNING id, created_at
    `;

    const messageResult = await db.query(messageQuery, [conversationId, adminId, content.trim()]);
    console.log('Message inserted successfully:', messageResult.rows[0]);

    // Update conversation timestamp
    await db.query(
      `UPDATE admin_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [conversationId]
    );

    const responseData = {
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
    };

    console.log('Sending response:', responseData);
    res.json(responseData);

  } catch (error) {
    console.error("Error sending admin message:", error);
    console.error("Stack trace:", error.stack);
    res.status(500).json({
      success: false,
      error: "Failed to send message",
      details: error.message
    });
  }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const stats = {
      total_applications: 0,
      pending_applications: 0,
      approved_applications: 0,
      rejected_applications: 0,
      applications_this_week: 0,
      applications_this_month: 0
    };

    // Get total applications
    const totalQuery = 'SELECT COUNT(*) as count FROM therapist_applications';
    const totalResult = await db.query(totalQuery);
    stats.total_applications = parseInt(totalResult.rows[0].count) || 0;

    // Get pending applications
    const pendingQuery = "SELECT COUNT(*) as count FROM therapist_applications WHERE status = 'pending'";
    const pendingResult = await db.query(pendingQuery);
    stats.pending_applications = parseInt(pendingResult.rows[0].count) || 0;

    // Get approved applications
    const approvedQuery = "SELECT COUNT(*) as count FROM therapist_applications WHERE status = 'approved'";
    const approvedResult = await db.query(approvedQuery);
    stats.approved_applications = parseInt(approvedResult.rows[0].count) || 0;

    // Get rejected applications
    const rejectedQuery = "SELECT COUNT(*) as count FROM therapist_applications WHERE status = 'rejected'";
    const rejectedResult = await db.query(rejectedQuery);
    stats.rejected_applications = parseInt(rejectedResult.rows[0].count) || 0;

    // Get applications this week
    const weekQuery = `
      SELECT COUNT(*) as count FROM therapist_applications
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    `;
    const weekResult = await db.query(weekQuery);
    stats.applications_this_week = parseInt(weekResult.rows[0].count) || 0;

    // Get applications this month
    const monthQuery = `
      SELECT COUNT(*) as count FROM therapist_applications
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `;
    const monthResult = await db.query(monthQuery);
    stats.applications_this_month = parseInt(monthResult.rows[0].count) || 0;

    return stats;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      total_applications: 0,
      pending_applications: 0,
      approved_applications: 0,
      rejected_applications: 0,
      applications_this_week: 0,
      applications_this_month: 0
    };
  }
};

// Get admin messages for conversation
exports.getAdminMessages = async (req, res) => {
  const conversationId = req.params.conversationId;
  const adminId = parseInt(req.session.user.id);

  try {
    console.log('Loading admin messages for conversation:', conversationId);

    // Get conversation details from admin_conversations table
    const convQuery = `
      SELECT ac.*,
             u.name as participant_name,
             u.email as participant_email,
             u.role as participant_role,
             u.profile_image as participant_image,
             ta.profile_image as therapist_image,
             ta.specialty as participant_specialty
      FROM admin_conversations ac
      JOIN users u ON ac.participant_id = u.id
      LEFT JOIN therapist_applications ta ON u.id = ta.user_id AND u.role = 'therapist'
      WHERE ac.id = $1 AND ac.admin_id = $2 AND ac.status = 'active'
    `;

    const convResult = await db.query(convQuery, [conversationId, adminId]);

    if (!convResult.rows || convResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    const conversation = convResult.rows[0];

    // Get messages from admin_messages table
    const messageQuery = `
      SELECT am.*, u.name as sender_name, u.role as sender_role
      FROM admin_messages am
      JOIN users u ON am.sender_id = u.id
      WHERE am.conversation_id = $1
      ORDER BY am.created_at ASC
    `;

    const messagesResult = await db.query(messageQuery, [conversationId]);

    // Format other user data
    const otherUser = {
      id: conversation.participant_id,
      name: conversation.participant_name,
      role: conversation.participant_role,
      image: conversation.participant_role === 'therapist' ? conversation.therapist_image : conversation.participant_image,
      specialty: conversation.participant_role === 'therapist' ?
        (conversation.participant_specialty || 'Therapist') : 'Patient'
    };

    res.json({
      success: true,
      conversation: {
        id: conversation.id,
        other_user: otherUser,
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
};

// Helper function to create notifications (simplified for compatibility)
async function createNotification(userId, type, title, message, data = {}) {
  try {
    const userIdInt = parseInt(userId);
    
    // Check if notifications table exists
    const tableCheck = await db.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'notifications'
    `);
    
    if (tableCheck.rows.length > 0) {
      const query = `
        INSERT INTO notifications (user_id, type, title, message, data, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        RETURNING id
      `;

      await db.query(query, [userIdInt, type, title, message, JSON.stringify(data)]);
      console.log('Notification created for user:', userIdInt, 'type:', type);
    } else {
      console.log('Notifications table not found, skipping notification');
    }
  } catch (error) {
    console.error("Error creating notification:", error);
    // Don't throw error - notifications are not critical
  }
}