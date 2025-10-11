-- Create drawing_sessions table
CREATE TABLE IF NOT EXISTS drawing_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_name VARCHAR(255),
    art_type VARCHAR(50) NOT NULL DEFAULT 'free_draw' CHECK (art_type IN ('free_draw', 'mandala', 'guided_meditation', 'emotion_expression', 'stress_relief')),
    duration INTEGER, -- in minutes
    mood_before VARCHAR(20) CHECK (mood_before IN ('very_stressed', 'stressed', 'neutral', 'calm', 'very_calm')),
    mood_after VARCHAR(20) CHECK (mood_after IN ('very_stressed', 'stressed', 'neutral', 'calm', 'very_calm')),
    tools_used JSON DEFAULT '[]',
    colors_used JSON DEFAULT '[]',
    canvas_size VARCHAR(20) DEFAULT '800x600',
    is_completed BOOLEAN DEFAULT false,
    session_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_drawing_sessions_user_id ON drawing_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_drawing_sessions_session_date ON drawing_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_drawing_sessions_art_type ON drawing_sessions(art_type);