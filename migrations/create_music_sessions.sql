-- Create music_sessions table
DROP TABLE IF EXISTS music_sessions CASCADE;
CREATE TABLE music_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255),
    category VARCHAR(50) NOT NULL CHECK (category IN ('calm', 'energetic', 'meditation', 'nature', 'classical', 'ambient', 'focus', 'sleep')),
    duration INTEGER, -- in seconds
    playlist_name VARCHAR(255),
    mood_before VARCHAR(20) CHECK (mood_before IN ('very_low', 'low', 'neutral', 'good', 'excellent')),
    mood_after VARCHAR(20) CHECK (mood_after IN ('very_low', 'low', 'neutral', 'good', 'excellent')),
    spotify_track_id VARCHAR(100),
    session_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_music_sessions_user_id ON music_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_music_sessions_session_date ON music_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_music_sessions_category ON music_sessions(category);