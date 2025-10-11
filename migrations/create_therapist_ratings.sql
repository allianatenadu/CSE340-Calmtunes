-- Migration: Create therapist ratings table
-- Description: Creates a table for patients to rate therapists after sessions

CREATE TABLE IF NOT EXISTS therapist_ratings (
    id SERIAL PRIMARY KEY,
    therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure one rating per patient per therapist
    UNIQUE(therapist_id, patient_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_therapist_ratings_therapist_id ON therapist_ratings(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_ratings_patient_id ON therapist_ratings(patient_id);
CREATE INDEX IF NOT EXISTS idx_therapist_ratings_appointment_id ON therapist_ratings(appointment_id);
CREATE INDEX IF NOT EXISTS idx_therapist_ratings_created_at ON therapist_ratings(created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_therapist_ratings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_therapist_ratings_updated_at
    BEFORE UPDATE ON therapist_ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_therapist_ratings_updated_at();