-- Add missing columns to drawing_sessions table
ALTER TABLE drawing_sessions
ADD COLUMN IF NOT EXISTS tools_used JSON DEFAULT '[]',
ADD COLUMN IF NOT EXISTS colors_used JSON DEFAULT '[]',
ADD COLUMN IF NOT EXISTS canvas_size VARCHAR(20) DEFAULT '800x600',
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add missing columns to music_sessions table if needed
ALTER TABLE music_sessions
ADD COLUMN IF NOT EXISTS mood_intensity INTEGER,
ADD COLUMN IF NOT EXISTS triggers TEXT,
ADD COLUMN IF NOT EXISTS activities TEXT;

-- Add missing columns to mood_entries table if needed
ALTER TABLE mood_entries
ADD COLUMN IF NOT EXISTS mood_intensity INTEGER,
ADD COLUMN IF NOT EXISTS triggers TEXT,
ADD COLUMN IF NOT EXISTS activities TEXT;