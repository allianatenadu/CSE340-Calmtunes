-- Migration to fix user ID UUID issue
-- This migration converts the users table to use UUID instead of SERIAL for id

-- First, let's check the current structure of the users table
-- Uncomment the line below to see the current structure:
-- \d users;

-- Step 1: Create a new users table with UUID primary key
CREATE TABLE IF NOT EXISTS users_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'patient',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Copy data from old table to new table
-- Note: This assumes your users table has these columns. Adjust as needed.
INSERT INTO users_new (id, name, email, password, role, created_at, updated_at)
SELECT
    -- Convert integer ID to UUID format (this is a best-effort conversion)
    -- In production, you'd want to generate proper UUIDs
    CASE
        WHEN id::text ~ '^[0-9]+$' THEN
            -- Convert integer to UUID-like format (not perfect but better than nothing)
            ('00000000-0000-0000-0000-' || LPAD(id::text, 12, '0'))::uuid
        ELSE
            gen_random_uuid() -- Fallback for non-integer IDs
    END as id,
    name,
    email,
    password,
    role,
    created_at,
    updated_at
FROM users;

-- Step 3: Drop the old table
DROP TABLE users;

-- Step 4: Rename the new table
ALTER TABLE users_new RENAME TO users;

-- Step 5: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Step 6: Update any foreign key references in other tables
-- You'll need to update these manually based on your schema:

-- For admin_conversations table:
-- ALTER TABLE admin_conversations DROP CONSTRAINT IF EXISTS admin_conversations_admin_id_fkey;
-- ALTER TABLE admin_conversations ADD CONSTRAINT admin_conversations_admin_id_fkey
--     FOREIGN KEY (admin_id) REFERENCES users(id);

-- ALTER TABLE admin_conversations DROP CONSTRAINT IF EXISTS admin_conversations_participant_id_fkey;
-- ALTER TABLE admin_conversations ADD CONSTRAINT admin_conversations_participant_id_fkey
--     FOREIGN KEY (participant_id) REFERENCES users(id);

-- For admin_messages table:
-- ALTER TABLE admin_messages DROP CONSTRAINT IF EXISTS admin_messages_conversation_id_fkey;
-- ALTER TABLE admin_messages ADD CONSTRAINT admin_messages_conversation_id_fkey
--     FOREIGN KEY (conversation_id) REFERENCES admin_conversations(id);

-- ALTER TABLE admin_messages DROP CONSTRAINT IF EXISTS admin_messages_sender_id_fkey;
-- ALTER TABLE admin_messages ADD CONSTRAINT admin_messages_sender_id_fkey
--     FOREIGN KEY (sender_id) REFERENCES users(id);

-- For notifications table:
-- ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
-- ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey
--     FOREIGN KEY (user_id) REFERENCES users(id);

-- Add any other foreign key constraints you have...

-- Step 7: Verify the migration
SELECT
    id,
    LEFT(id::text, 8) as id_prefix,
    name,
    email,
    role
FROM users
LIMIT 5;