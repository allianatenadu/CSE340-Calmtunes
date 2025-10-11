-- Add artwork_image column to drawing_sessions table
ALTER TABLE drawing_sessions
ADD COLUMN IF NOT EXISTS artwork_image VARCHAR(255);

-- Add comment to document the column purpose
COMMENT ON COLUMN drawing_sessions.artwork_image IS 'Path to the saved artwork image file in public/uploads/drawings/ directory';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_drawing_sessions_artwork_image ON drawing_sessions(artwork_image) WHERE artwork_image IS NOT NULL;