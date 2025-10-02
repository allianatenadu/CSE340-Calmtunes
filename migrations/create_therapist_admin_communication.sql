-- Migration: Create therapist-admin communication tables
-- Date: 2025-10-02
-- Description: Creates tables for therapist-admin messaging system

-- Therapist-Admin Conversations table
CREATE TABLE IF NOT EXISTS therapist_admin_conversations (
    id UUID PRIMARY KEY,
    therapist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(therapist_id, admin_id)
);

-- Therapist-Admin Messages table
CREATE TABLE IF NOT EXISTS therapist_admin_messages (
    id SERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES therapist_admin_conversations(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'system')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_therapist_admin_conversations_therapist_id ON therapist_admin_conversations(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_admin_conversations_admin_id ON therapist_admin_conversations(admin_id);
CREATE INDEX IF NOT EXISTS idx_therapist_admin_conversations_status ON therapist_admin_conversations(status);
CREATE INDEX IF NOT EXISTS idx_therapist_admin_conversations_updated_at ON therapist_admin_conversations(updated_at);

CREATE INDEX IF NOT EXISTS idx_therapist_admin_messages_conversation_id ON therapist_admin_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_therapist_admin_messages_sender_id ON therapist_admin_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_therapist_admin_messages_created_at ON therapist_admin_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_therapist_admin_messages_is_read ON therapist_admin_messages(is_read);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_therapist_admin_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_therapist_admin_conversations_updated_at
    BEFORE UPDATE ON therapist_admin_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_therapist_admin_conversations_updated_at();