-- Create panic_sessions table
CREATE TABLE IF NOT EXISTS panic_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    duration INTEGER, -- in milliseconds
    trigger_method VARCHAR(50) DEFAULT 'manual',
    breathing_used BOOLEAN DEFAULT false,
    emergency_contacts_used JSON DEFAULT '[]',
    audio_recordings JSON DEFAULT '[]',
    session_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_panic_sessions_user_id ON panic_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_panic_sessions_start_time ON panic_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_panic_sessions_session_id ON panic_sessions(session_id);