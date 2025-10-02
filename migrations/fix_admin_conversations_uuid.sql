-- Migration to fix admin conversations UUID issue
-- This migration converts admin conversation tables to use UUID instead of SERIAL for IDs

-- Step 1: Create new admin_conversations table with UUID primary key
CREATE TABLE IF NOT EXISTS admin_conversations_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Step 2: Create new admin_messages table with UUID conversation_id
CREATE TABLE IF NOT EXISTS admin_messages_new (
    id SERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES admin_conversations_new(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text'
        CHECK (message_type IN ('text', 'system', 'file', 'concern', 'contract')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Step 3: Create new admin_concerns table with UUID conversation_id
CREATE TABLE IF NOT EXISTS admin_concerns_new (
    id SERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES admin_conversations_new(id) ON DELETE CASCADE,
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

-- Step 4: Create new admin_contracts table with UUID conversation_id
CREATE TABLE IF NOT EXISTS admin_contracts_new (
    id SERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES admin_conversations_new(id) ON DELETE CASCADE,
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

-- Step 5: Copy existing data if tables exist (with UUID conversion)
-- Note: This will only work if the old tables exist and have data
DO $$
BEGIN
    -- Copy admin_conversations data
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admin_conversations') THEN
        INSERT INTO admin_conversations_new (
            id, admin_id, participant_id, participant_type, conversation_type,
            status, subject, priority, created_at, updated_at, closed_at
        )
        SELECT
            gen_random_uuid(), -- Generate new UUID for each conversation
            admin_id,
            participant_id,
            participant_type,
            conversation_type,
            status,
            subject,
            priority,
            created_at,
            updated_at,
            closed_at
        FROM admin_conversations;
        RAISE NOTICE 'Copied % records from admin_conversations to admin_conversations_new', (SELECT COUNT(*) FROM admin_conversations);
    END IF;

    -- Copy admin_messages data
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admin_messages') THEN
        INSERT INTO admin_messages_new (
            conversation_id, sender_id, content, message_type, is_read, created_at, metadata
        )
        SELECT
            ac_new.id, -- Use the new UUID from the corresponding conversation
            am.sender_id,
            am.content,
            am.message_type,
            am.is_read,
            am.created_at,
            am.metadata
        FROM admin_messages am
        JOIN admin_conversations ac_old ON am.conversation_id = ac_old.id
        JOIN admin_conversations_new ac_new ON ac_new.admin_id = ac_old.admin_id
            AND ac_new.participant_id = ac_old.participant_id
            AND ac_new.participant_type = ac_old.participant_type;
        RAISE NOTICE 'Copied % records from admin_messages to admin_messages_new', (SELECT COUNT(*) FROM admin_messages);
    END IF;

    -- Copy admin_concerns data
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admin_concerns') THEN
        INSERT INTO admin_concerns_new (
            conversation_id, patient_id, concern_type, severity, title,
            description, status, assigned_admin_id, created_at, updated_at,
            resolved_at, resolution_notes
        )
        SELECT
            ac_new.id, -- Use the new UUID from the corresponding conversation
            acn.patient_id,
            acn.concern_type,
            acn.severity,
            acn.title,
            acn.description,
            acn.status,
            acn.assigned_admin_id,
            acn.created_at,
            acn.updated_at,
            acn.resolved_at,
            acn.resolution_notes
        FROM admin_concerns acn
        JOIN admin_conversations ac_old ON acn.conversation_id = ac_old.id
        JOIN admin_conversations_new ac_new ON ac_new.admin_id = ac_old.admin_id
            AND ac_new.participant_id = ac_old.participant_id
            AND ac_new.participant_type = ac_old.participant_type;
        RAISE NOTICE 'Copied % records from admin_concerns to admin_concerns_new', (SELECT COUNT(*) FROM admin_concerns);
    END IF;

    -- Copy admin_contracts data
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admin_contracts') THEN
        INSERT INTO admin_contracts_new (
            conversation_id, therapist_id, contract_type, title, content,
            status, requires_acknowledgment, acknowledgment_deadline,
            created_at, acknowledged_at, acknowledged_by
        )
        SELECT
            ac_new.id, -- Use the new UUID from the corresponding conversation
            act.therapist_id,
            act.contract_type,
            act.title,
            act.content,
            act.status,
            act.requires_acknowledgment,
            act.acknowledgment_deadline,
            act.created_at,
            act.acknowledged_at,
            act.acknowledged_by
        FROM admin_contracts act
        JOIN admin_conversations ac_old ON act.conversation_id = ac_old.id
        JOIN admin_conversations_new ac_new ON ac_new.admin_id = ac_old.admin_id
            AND ac_new.participant_id = ac_old.participant_id
            AND ac_new.participant_type = ac_old.participant_type;
        RAISE NOTICE 'Copied % records from admin_contracts to admin_contracts_new', (SELECT COUNT(*) FROM admin_contracts);
    END IF;
END $$;

-- Step 6: Drop old tables (if they exist)
DROP TABLE IF EXISTS admin_contracts CASCADE;
DROP TABLE IF EXISTS admin_concerns CASCADE;
DROP TABLE IF EXISTS admin_messages CASCADE;
DROP TABLE IF EXISTS admin_conversations CASCADE;

-- Step 7: Rename new tables
ALTER TABLE admin_conversations_new RENAME TO admin_conversations;
ALTER TABLE admin_messages_new RENAME TO admin_messages;
ALTER TABLE admin_concerns_new RENAME TO admin_concerns;
ALTER TABLE admin_contracts_new RENAME TO admin_contracts;

-- Step 8: Create indexes for better performance
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

-- Step 9: Create trigger to update updated_at timestamp
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

-- Step 10: Create views for easier data access

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

-- Step 11: Display setup completion message
DO $$
BEGIN
    RAISE NOTICE '✅ Admin Conversations UUID Migration Complete!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Tables Updated:';
    RAISE NOTICE '  - admin_conversations (id changed to UUID)';
    RAISE NOTICE '  - admin_messages (conversation_id changed to UUID)';
    RAISE NOTICE '  - admin_concerns (conversation_id changed to UUID)';
    RAISE NOTICE '  - admin_contracts (conversation_id changed to UUID)';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Changes Made:';
    RAISE NOTICE '  - All conversation IDs now use UUID format';
    RAISE NOTICE '  - Foreign key relationships updated';
    RAISE NOTICE '  - Indexes recreated for performance';
    RAISE NOTICE '  - Views updated to work with UUIDs';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Next Steps:';
    RAISE NOTICE '  1. Run this migration in your PostgreSQL database';
    RAISE NOTICE '  2. Test the admin chat functionality';
    RAISE NOTICE '  3. Verify all admin chat features work correctly';
END $$;

-- Step 12: Show table structures and counts
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