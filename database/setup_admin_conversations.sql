-- =============================================
-- CALMTUNES - ADMIN CONVERSATIONS SYSTEM
-- Complete SQL Setup for Admin Chat Features
-- =============================================

-- 1. Create admin_conversations table
CREATE TABLE IF NOT EXISTS admin_conversations (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_type VARCHAR(20) NOT NULL CHECK (participant_type IN ('therapist', 'patient')),
    conversation_type VARCHAR(50) NOT NULL DEFAULT 'general'
        CHECK (conversation_type IN ('general', 'concern', 'contract', 'support')),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'closed', 'archived')),
    subject VARCHAR(255),
    priority VARCHAR(20) DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(admin_id, participant_id, participant_type)
);

-- Add comments
COMMENT ON TABLE admin_conversations IS 'Conversations between admins and therapists/patients';
COMMENT ON COLUMN admin_conversations.admin_id IS 'ID of the admin user';
COMMENT ON COLUMN admin_conversations.participant_id IS 'ID of the therapist or patient';
COMMENT ON COLUMN admin_conversations.participant_type IS 'Type of participant: therapist or patient';
COMMENT ON COLUMN admin_conversations.conversation_type IS 'Type of conversation: general, concern, contract, support';
COMMENT ON COLUMN admin_conversations.status IS 'Conversation status: active, closed, archived';
COMMENT ON COLUMN admin_conversations.subject IS 'Optional subject/topic of the conversation';
COMMENT ON COLUMN admin_conversations.priority IS 'Priority level: low, normal, high, urgent';

-- 2. Create admin_messages table
CREATE TABLE IF NOT EXISTS admin_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES admin_conversations(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text'
        CHECK (message_type IN ('text', 'system', 'file', 'concern', 'contract')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB -- For additional data like file info, concern details, etc.
);

-- Add comments
COMMENT ON TABLE admin_messages IS 'Messages in admin conversations';
COMMENT ON COLUMN admin_messages.conversation_id IS 'ID of the admin conversation';
COMMENT ON COLUMN admin_messages.sender_id IS 'ID of the user who sent the message';
COMMENT ON COLUMN admin_messages.content IS 'Message content';
COMMENT ON COLUMN admin_messages.message_type IS 'Type of message: text, system, file, concern, contract';
COMMENT ON COLUMN admin_messages.is_read IS 'Whether the message has been read';
COMMENT ON COLUMN admin_messages.metadata IS 'Additional metadata for files, concerns, contracts, etc.';

-- 3. Create admin_concerns table for tracking patient concerns
CREATE TABLE IF NOT EXISTS admin_concerns (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES admin_conversations(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    concern_type VARCHAR(50) NOT NULL
        CHECK (concern_type IN ('technical', 'therapist', 'platform', 'billing', 'other')),
    severity VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    assigned_admin_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT
);

-- Add comments
COMMENT ON TABLE admin_concerns IS 'Patient concerns submitted to admin';
COMMENT ON COLUMN admin_concerns.conversation_id IS 'Related admin conversation ID';
COMMENT ON COLUMN admin_concerns.patient_id IS 'ID of the patient with the concern';
COMMENT ON COLUMN admin_concerns.concern_type IS 'Type of concern: technical, therapist, platform, billing, other';
COMMENT ON COLUMN admin_concerns.severity IS 'Severity level: low, medium, high, critical';
COMMENT ON COLUMN admin_concerns.title IS 'Concern title';
COMMENT ON COLUMN admin_concerns.description IS 'Detailed concern description';
COMMENT ON COLUMN admin_concerns.status IS 'Concern status: open, investigating, resolved, closed';
COMMENT ON COLUMN admin_concerns.assigned_admin_id IS 'Admin assigned to handle this concern';
COMMENT ON COLUMN admin_concerns.resolution_notes IS 'Notes on how the concern was resolved';

-- 4. Create admin_contracts table for therapist contracts/rules
CREATE TABLE IF NOT EXISTS admin_contracts (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES admin_conversations(id) ON DELETE CASCADE,
    therapist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contract_type VARCHAR(50) NOT NULL
        CHECK (contract_type IN ('terms_update', 'policy_change', 'guidelines', 'requirements', 'other')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'acknowledged', 'rejected', 'expired')),
    requires_acknowledgment BOOLEAN DEFAULT TRUE,
    acknowledgment_deadline TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by INTEGER REFERENCES users(id)
);

-- Add comments
COMMENT ON TABLE admin_contracts IS 'Contracts and policy updates for therapists';
COMMENT ON COLUMN admin_contracts.conversation_id IS 'Related admin conversation ID';
COMMENT ON COLUMN admin_contracts.therapist_id IS 'ID of the therapist receiving the contract';
COMMENT ON COLUMN admin_contracts.contract_type IS 'Type of contract: terms_update, policy_change, guidelines, requirements, other';
COMMENT ON COLUMN admin_contracts.title IS 'Contract title';
COMMENT ON COLUMN admin_contracts.content IS 'Contract content';
COMMENT ON COLUMN admin_contracts.status IS 'Contract status: pending, acknowledged, rejected, expired';
COMMENT ON COLUMN admin_contracts.requires_acknowledgment IS 'Whether acknowledgment is required';
COMMENT ON COLUMN admin_contracts.acknowledgment_deadline IS 'Deadline for acknowledgment';
COMMENT ON COLUMN admin_contracts.acknowledged_by IS 'Admin who acknowledged the contract';

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_conversations_admin_id
    ON admin_conversations(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_conversations_participant_id
    ON admin_conversations(participant_id);

CREATE INDEX IF NOT EXISTS idx_admin_conversations_participant_type
    ON admin_conversations(participant_type);

CREATE INDEX IF NOT EXISTS idx_admin_conversations_status
    ON admin_conversations(status);

CREATE INDEX IF NOT EXISTS idx_admin_conversations_type
    ON admin_conversations(conversation_type);

CREATE INDEX IF NOT EXISTS idx_admin_conversations_priority
    ON admin_conversations(priority);

CREATE INDEX IF NOT EXISTS idx_admin_conversations_created_at
    ON admin_conversations(created_at);

CREATE INDEX IF NOT EXISTS idx_admin_messages_conversation_id
    ON admin_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_admin_messages_sender_id
    ON admin_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_admin_messages_is_read
    ON admin_messages(is_read);

CREATE INDEX IF NOT EXISTS idx_admin_messages_created_at
    ON admin_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_admin_concerns_patient_id
    ON admin_concerns(patient_id);

CREATE INDEX IF NOT EXISTS idx_admin_concerns_status
    ON admin_concerns(status);

CREATE INDEX IF NOT EXISTS idx_admin_concerns_severity
    ON admin_concerns(severity);

CREATE INDEX IF NOT EXISTS idx_admin_concerns_type
    ON admin_concerns(concern_type);

CREATE INDEX IF NOT EXISTS idx_admin_contracts_therapist_id
    ON admin_contracts(therapist_id);

CREATE INDEX IF NOT EXISTS idx_admin_contracts_status
    ON admin_contracts(status);

CREATE INDEX IF NOT EXISTS idx_admin_contracts_type
    ON admin_contracts(contract_type);

-- 6. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to admin_conversations table
DROP TRIGGER IF EXISTS update_admin_conversations_updated_at
    ON admin_conversations;
CREATE TRIGGER update_admin_conversations_updated_at
    BEFORE UPDATE ON admin_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to admin_concerns table
DROP TRIGGER IF EXISTS update_admin_concerns_updated_at
    ON admin_concerns;
CREATE TRIGGER update_admin_concerns_updated_at
    BEFORE UPDATE ON admin_concerns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Create views for easier data access

-- View for admin conversations with participant details
CREATE OR REPLACE VIEW admin_conversations_with_details AS
SELECT
    ac.id,
    ac.admin_id,
    ac.participant_id,
    ac.participant_type,
    ac.conversation_type,
    ac.status,
    ac.subject,
    ac.priority,
    ac.created_at,
    ac.updated_at,
    ac.closed_at,
    u_admin.name as admin_name,
    u_admin.email as admin_email,
    u_participant.name as participant_name,
    u_participant.email as participant_email,
    u_participant.role as participant_role,
    CASE
        WHEN ac.participant_type = 'therapist' THEN ta.specialty
        ELSE NULL
    END as participant_specialty,
    CASE
        WHEN ac.participant_type = 'therapist' THEN ta.profile_image
        ELSE u_participant.profile_image
    END as participant_image,
    (
        SELECT COUNT(*)
        FROM admin_messages am
        WHERE am.conversation_id = ac.id AND am.is_read = FALSE
        AND am.sender_id != ac.admin_id
    ) as unread_count,
    (
        SELECT content
        FROM admin_messages am
        WHERE am.conversation_id = ac.id
        ORDER BY am.created_at DESC
        LIMIT 1
    ) as last_message,
    (
        SELECT created_at
        FROM admin_messages am
        WHERE am.conversation_id = ac.id
        ORDER BY am.created_at DESC
        LIMIT 1
    ) as last_message_time
FROM admin_conversations ac
JOIN users u_admin ON ac.admin_id = u_admin.id
JOIN users u_participant ON ac.participant_id = u_participant.id
LEFT JOIN therapist_applications ta ON ac.participant_type = 'therapist'
    AND u_participant.id = ta.user_id;

-- View for active concerns
CREATE OR REPLACE VIEW active_admin_concerns AS
SELECT
    c.*,
    u.name as patient_name,
    u.email as patient_email,
    u_admin.name as assigned_admin_name
FROM admin_concerns c
JOIN users u ON c.patient_id = u.id
LEFT JOIN users u_admin ON c.assigned_admin_id = u_admin.id
WHERE c.status IN ('open', 'investigating');

-- View for pending contracts
CREATE OR REPLACE VIEW pending_admin_contracts AS
SELECT
    c.*,
    u.name as therapist_name,
    u.email as therapist_email,
    ta.specialty
FROM admin_contracts c
JOIN users u ON c.therapist_id = u.id
LEFT JOIN therapist_applications ta ON u.id = ta.user_id
WHERE c.status = 'pending';

-- 8. Create functions for common operations

-- Function to get admin conversation count
CREATE OR REPLACE FUNCTION get_admin_conversation_count(admin_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    count INTEGER;
BEGIN
    SELECT COUNT(*) INTO count
    FROM admin_conversations
    WHERE admin_conversations.admin_id = admin_id AND status = 'active';

    RETURN count;
END;
$$ LANGUAGE plpgsql;

-- Function to create admin conversation notification
CREATE OR REPLACE FUNCTION notify_admin_conversation(
    participant_id INTEGER,
    admin_name TEXT,
    conversation_type TEXT DEFAULT 'general'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO notifications (user_id, type, title, message, created_at)
    VALUES (
        participant_id,
        'admin_conversation',
        'New Admin Message',
        CASE
            WHEN conversation_type = 'concern' THEN 'An admin wants to discuss your concern.'
            WHEN conversation_type = 'contract' THEN 'An admin has sent you an important contract or policy update.'
            ELSE 'You have a new message from an admin.'
        END,
        CURRENT_TIMESTAMP
    );
END;
$$ LANGUAGE plpgsql;

-- Function to create concern notification
CREATE OR REPLACE FUNCTION notify_admin_concern(
    admin_id INTEGER,
    patient_name TEXT,
    concern_type TEXT,
    severity TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO notifications (user_id, type, title, message, created_at)
    VALUES (
        admin_id,
        'admin_concern',
        'New Patient Concern',
        'Patient ' || patient_name || ' has submitted a ' || severity || ' priority ' || concern_type || ' concern.',
        CURRENT_TIMESTAMP
    );
END;
$$ LANGUAGE plpgsql;

-- 9. Sample data for testing (optional - remove in production)
-- Uncomment the following lines if you want to add sample data for testing

/*
-- Sample admin conversation
INSERT INTO admin_conversations (admin_id, participant_id, participant_type, conversation_type, subject, priority)
VALUES (1, 2, 'patient', 'concern', 'Technical Support Issue', 'high')
ON CONFLICT (admin_id, participant_id, participant_type) DO NOTHING;

-- Sample admin message
INSERT INTO admin_messages (conversation_id, sender_id, content, message_type)
VALUES (1, 1, 'Hello! I understand you have a technical concern. Can you please describe the issue?', 'text');

-- Sample concern
INSERT INTO admin_concerns (conversation_id, patient_id, concern_type, severity, title, description, status)
VALUES (1, 2, 'technical', 'high', 'Cannot access chat feature', 'I am unable to access the chat feature on the platform. The page loads but messages do not send.', 'open');
*/

-- 10. Display setup completion message
DO $$
BEGIN
    RAISE NOTICE '✅ Admin Conversations System Setup Complete!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Tables Created:';
    RAISE NOTICE '  - admin_conversations';
    RAISE NOTICE '  - admin_messages';
    RAISE NOTICE '  - admin_concerns';
    RAISE NOTICE '  - admin_contracts';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Features Added:';
    RAISE NOTICE '  - Admin chat with therapists and patients';
    RAISE NOTICE '  - Concern management system';
    RAISE NOTICE '  - Contract/policy management';
    RAISE NOTICE '  - Priority and status tracking';
    RAISE NOTICE '  - Notification system';
    RAISE NOTICE '  - Views for data access';
    RAISE NOTICE '  - Helper functions';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Next Steps:';
    RAISE NOTICE '  1. Run this SQL in your PostgreSQL database';
    RAISE NOTICE '  2. Create admin chat controllers and routes';
    RAISE NOTICE '  3. Build admin chat UI components';
    RAISE NOTICE '  4. Test the admin chat functionality';
END $$;

-- 11. Show table structures and counts
SELECT
    'admin_conversations' as table_name,
    COUNT(*) as record_count
FROM admin_conversations
UNION ALL
SELECT
    'admin_messages' as table_name,
    COUNT(*) as record_count
FROM admin_messages
UNION ALL
SELECT
    'admin_concerns' as table_name,
    COUNT(*) as record_count
FROM admin_concerns
UNION ALL
SELECT
    'admin_contracts' as table_name,
    COUNT(*) as record_count
FROM admin_contracts;