-- Migration: Enhance messages table for advanced chat features
-- Created: 2025-10-06
-- Description: Adds support for file sharing, reactions, message status, and typing indicators

-- First, let's check if the messages table exists and get its structure
DO $$
DECLARE
    messages_exists BOOLEAN := FALSE;
    id_column_type TEXT := '';
BEGIN
    -- Check if messages table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'messages'
    ) INTO messages_exists;

    IF messages_exists THEN
        -- Get the type of the id column
        SELECT data_type INTO id_column_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'messages'
        AND column_name = 'id';

        RAISE NOTICE 'Messages table exists with id column type: %', id_column_type;
    ELSE
        RAISE NOTICE 'Messages table does not exist, will be created';
    END IF;
END $$;

-- Add new columns to messages table (if it exists)
-- Note: reply_to_id will be added after we verify the messages table structure
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS message_status VARCHAR(20) DEFAULT 'sent' CHECK (message_status IN ('sent', 'delivered', 'read')),
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS file_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS image_width INTEGER,
ADD COLUMN IF NOT EXISTS image_height INTEGER,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS edited_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Check the actual structure of the messages table and add reply_to_id accordingly
DO $$
DECLARE
    id_column_type TEXT := '';
    messages_exists BOOLEAN := FALSE;
BEGIN
    -- Check if messages table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'messages'
    ) INTO messages_exists;

    IF messages_exists THEN
        -- Get the type of the id column
        SELECT data_type INTO id_column_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'messages'
        AND column_name = 'id';

        RAISE NOTICE 'Messages table exists with id column type: %', id_column_type;

        -- Add reply_to_id column with the same type as id column
        IF id_column_type = 'uuid' THEN
            -- Add UUID reply_to_id column
            ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID;
            RAISE NOTICE 'Added UUID reply_to_id column';
        ELSIF id_column_type = 'integer' THEN
            -- Add INTEGER reply_to_id column
            ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER;
            RAISE NOTICE 'Added INTEGER reply_to_id column';
        ELSE
            RAISE NOTICE 'Unknown id column type: %, adding UUID reply_to_id as default', id_column_type;
            ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID;
        END IF;
    ELSE
        RAISE NOTICE 'Messages table does not exist';
    END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(message_status);
CREATE INDEX IF NOT EXISTS idx_messages_file_url ON messages(file_url);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Add foreign key constraint for reply_to_id after column exists
DO $$
DECLARE
    id_column_type TEXT := '';
BEGIN
    -- Get the type of the id column again for the constraint
    SELECT data_type INTO id_column_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'messages'
    AND column_name = 'id';

    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT FROM information_schema.table_constraints
        WHERE table_name = 'messages'
        AND constraint_name = 'messages_reply_to_id_fkey'
    ) THEN
        -- Add the foreign key constraint with the correct type
        IF id_column_type = 'uuid' THEN
            ALTER TABLE messages
            ADD CONSTRAINT messages_reply_to_id_fkey
            FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL;
        ELSIF id_column_type = 'integer' THEN
            ALTER TABLE messages
            ADD CONSTRAINT messages_reply_to_id_fkey
            FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL;
        END IF;

        RAISE NOTICE 'Added foreign key constraint for reply_to_id with type: %', id_column_type;
    ELSE
        RAISE NOTICE 'Foreign key constraint for reply_to_id already exists';
    END IF;
END $$;

-- Create message_reactions table for detailed reaction tracking
CREATE TABLE IF NOT EXISTS message_reactions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id, reaction_type)
);

-- Create index for message reactions
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);

-- Create typing_indicators table for real-time typing status
CREATE TABLE IF NOT EXISTS typing_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_typing BOOLEAN DEFAULT true,
    last_typed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(conversation_id, user_id)
);

-- Create index for typing indicators
CREATE INDEX IF NOT EXISTS idx_typing_indicators_conversation ON typing_indicators(conversation_id);
CREATE INDEX IF NOT EXISTS idx_typing_indicators_last_typed ON typing_indicators(last_typed);

-- Create message_attachments table for multiple file support
CREATE TABLE IF NOT EXISTS message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(100),
    mime_type VARCHAR(100),
    image_width INTEGER,
    image_height INTEGER,
    thumbnail_url TEXT,
    upload_status VARCHAR(20) DEFAULT 'completed' CHECK (upload_status IN ('uploading', 'completed', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for message attachments
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_file_url ON message_attachments(file_url);

-- Update existing messages to have proper status
UPDATE messages SET message_status = 'sent' WHERE message_status IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN messages.message_status IS 'Status of the message: sent, delivered, read';
COMMENT ON COLUMN messages.file_url IS 'URL to attached file (for backward compatibility)';
COMMENT ON COLUMN messages.reactions IS 'JSON array of reaction objects with user_id and emoji';
COMMENT ON COLUMN messages.reply_to_id IS 'ID of message being replied to';
COMMENT ON COLUMN messages.metadata IS 'Additional message metadata as JSON';

COMMENT ON TABLE message_reactions IS 'Detailed tracking of individual user reactions to messages';
COMMENT ON TABLE typing_indicators IS 'Real-time typing status for users in conversations';
COMMENT ON TABLE message_attachments IS 'Multiple file attachments for messages';