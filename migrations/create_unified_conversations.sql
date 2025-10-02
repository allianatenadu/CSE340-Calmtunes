-- Migration to create unified conversations and messages tables
-- This creates the tables that the chat controller expects

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant1_role VARCHAR(20) NOT NULL,
    participant2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant2_role VARCHAR(20) NOT NULL,
    conversation_type VARCHAR(20) NOT NULL DEFAULT 'regular'
        CHECK (conversation_type IN ('regular', 'admin')),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'closed', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(participant1_id, participant2_id, participant1_role, participant2_role, conversation_type)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text'
        CHECK (message_type IN ('text', 'system', 'file', 'image')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_participant1_id
    ON conversations(participant1_id);

CREATE INDEX IF NOT EXISTS idx_conversations_participant2_id
    ON conversations(participant2_id);

CREATE INDEX IF NOT EXISTS idx_conversations_participant1_role
    ON conversations(participant1_role);

CREATE INDEX IF NOT EXISTS idx_conversations_participant2_role
    ON conversations(participant2_role);

CREATE INDEX IF NOT EXISTS idx_conversations_type
    ON conversations(conversation_type);

CREATE INDEX IF NOT EXISTS idx_conversations_status
    ON conversations(status);

CREATE INDEX IF NOT EXISTS idx_conversations_created_at
    ON conversations(created_at);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
    ON conversations(updated_at);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
    ON messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id
    ON messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_is_read
    ON messages(is_read);

CREATE INDEX IF NOT EXISTS idx_messages_created_at
    ON messages(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_conversations_updated_at_trigger
    ON conversations;
CREATE TRIGGER update_conversations_updated_at_trigger
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_conversations_updated_at();

-- Create view for conversations with participant details (similar to chat controller expectations)
CREATE OR REPLACE VIEW conversations_with_details AS
SELECT
    c.*,
    u1.name as participant1_name, u1.email as participant1_email,
    u2.name as participant2_name, u2.email as participant2_email,
    ta1.profile_image as participant1_image, ta1.specialty as participant1_specialty,
    ta2.profile_image as participant2_image, ta2.specialty as participant2_specialty,
    m.content as last_message, m.created_at as last_message_time,
    COUNT(CASE WHEN m2.is_read = false AND m2.sender_id !=
        CASE
            WHEN c.participant1_id = $1 THEN c.participant1_id
            ELSE c.participant2_id
        END
    THEN 1 END) as unread_count
FROM conversations c
JOIN users u1 ON c.participant1_id = u1.id
JOIN users u2 ON c.participant2_id = u2.id
LEFT JOIN therapist_applications ta1 ON u1.id = ta1.user_id AND u1.role = 'therapist'
LEFT JOIN therapist_applications ta2 ON u2.id = ta2.user_id AND u2.role = 'therapist'
LEFT JOIN messages m ON c.id = m.conversation_id
    AND m.created_at = (SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id)
LEFT JOIN messages m2 ON c.id = m2.conversation_id
WHERE (c.participant1_id = $1 OR c.participant2_id = $1) AND c.status = 'active'
GROUP BY c.id, u1.name, u1.email, u2.name, u2.email,
         ta1.profile_image, ta1.specialty, ta2.profile_image, ta2.specialty,
         m.content, m.created_at;

-- Display setup completion message
DO $$
BEGIN
    RAISE NOTICE '✅ Unified Conversations System Setup Complete!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Tables Created:';
    RAISE NOTICE '  - conversations (unified conversation management)';
    RAISE NOTICE '  - messages (unified message storage)';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Features Added:';
    RAISE NOTICE '  - Support for patient-therapist conversations';
    RAISE NOTICE '  - Support for admin conversations';
    RAISE NOTICE '  - Message read status tracking';
    RAISE NOTICE '  - Optimized indexes for performance';
    RAISE NOTICE '  - Auto-updating timestamps';
    RAISE NOTICE '  - View for conversation details';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Next Steps:';
    RAISE NOTICE '  1. Run this migration in your PostgreSQL database';
    RAISE NOTICE '  2. Test the chat functionality';
    RAISE NOTICE '  3. Verify conversations work between patients and therapists';
END $$;

-- Show table structures and counts
SELECT
    'conversations' as table_name,
    COUNT(*) as record_count
FROM conversations
UNION ALL
SELECT
    'messages' as table_name,
    COUNT(*) as record_count
FROM messages;