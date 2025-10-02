-- Create panic_sessions table
CREATE TABLE IF NOT EXISTS panic_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  therapist_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  start_time TIMESTAMP NOT NULL,
  duration INTEGER NOT NULL,
  breathing_used BOOLEAN DEFAULT false,
  emergency_contacts_used JSONB DEFAULT '[]'::JSONB,
  trigger_method VARCHAR(50),
  audio_recordings JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for better performance
CREATE INDEX IF NOT EXISTS idx_panic_sessions_user_id ON panic_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_panic_sessions_therapist_id ON panic_sessions(therapist_id);
CREATE INDEX IF NOT EXISTS idx_panic_sessions_start_time ON panic_sessions(start_time);