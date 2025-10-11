-- =============================================
-- CALMTUNES - APPOINTMENTS SYSTEM
-- Complete SQL Setup for Appointments Management
-- =============================================

-- 1. Create appointments table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments') THEN
        CREATE TABLE appointments (
            id SERIAL PRIMARY KEY,
            patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            therapist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            appointment_date DATE NOT NULL,
            appointment_time TIME NOT NULL,
            session_type VARCHAR(20) NOT NULL DEFAULT 'video'
                CHECK (session_type IN ('video', 'in-person')),
            status VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
            notes TEXT,
            meeting_link TEXT,
            cancellation_reason TEXT,
            patient_location JSONB,
            therapist_location JSONB,
            proximity_alert_sent BOOLEAN DEFAULT FALSE,
            proximity_alert_time TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(therapist_id, appointment_date, appointment_time)
        );
        RAISE NOTICE '✅ Created appointments table';
    ELSE
        RAISE NOTICE '✅ Appointments table already exists, checking for missing columns...';

        -- Add missing columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'cancellation_reason') THEN
            ALTER TABLE appointments ADD COLUMN cancellation_reason TEXT;
            RAISE NOTICE '✅ Added cancellation_reason column';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'patient_location') THEN
            ALTER TABLE appointments ADD COLUMN patient_location JSONB;
            RAISE NOTICE '✅ Added patient_location column';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'therapist_location') THEN
            ALTER TABLE appointments ADD COLUMN therapist_location JSONB;
            RAISE NOTICE '✅ Added therapist_location column';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'proximity_alert_sent') THEN
            ALTER TABLE appointments ADD COLUMN proximity_alert_sent BOOLEAN DEFAULT FALSE;
            RAISE NOTICE '✅ Added proximity_alert_sent column';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'proximity_alert_time') THEN
            ALTER TABLE appointments ADD COLUMN proximity_alert_time TIMESTAMP WITH TIME ZONE;
            RAISE NOTICE '✅ Added proximity_alert_time column';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'meeting_link') THEN
            ALTER TABLE appointments ADD COLUMN meeting_link TEXT;
            RAISE NOTICE '✅ Added meeting_link column';
        END IF;
    END IF;
END $$;

-- Add comments
COMMENT ON TABLE appointments IS 'Stores appointment information between patients and therapists';
COMMENT ON COLUMN appointments.patient_id IS 'ID of the patient';
COMMENT ON COLUMN appointments.therapist_id IS 'ID of the therapist';
COMMENT ON COLUMN appointments.appointment_date IS 'Date of the appointment';
COMMENT ON COLUMN appointments.appointment_time IS 'Time of the appointment';
COMMENT ON COLUMN appointments.session_type IS 'Type of session: video or in-person';
COMMENT ON COLUMN appointments.status IS 'Appointment status: pending, confirmed, cancelled, completed';
COMMENT ON COLUMN appointments.notes IS 'Additional notes for the appointment';
COMMENT ON COLUMN appointments.meeting_link IS 'Video meeting link for video sessions';
COMMENT ON COLUMN appointments.cancellation_reason IS 'Reason for cancellation if applicable';
COMMENT ON COLUMN appointments.patient_location IS 'Patient location data for in-person appointments';
COMMENT ON COLUMN appointments.therapist_location IS 'Therapist location data for in-person appointments';
COMMENT ON COLUMN appointments.proximity_alert_sent IS 'Whether proximity alert has been sent';

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id
    ON appointments(patient_id);

CREATE INDEX IF NOT EXISTS idx_appointments_therapist_id
    ON appointments(therapist_id);

CREATE INDEX IF NOT EXISTS idx_appointments_date
    ON appointments(appointment_date);

CREATE INDEX IF NOT EXISTS idx_appointments_time
    ON appointments(appointment_time);

CREATE INDEX IF NOT EXISTS idx_appointments_status
    ON appointments(status);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_date
    ON appointments(patient_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_appointments_therapist_date
    ON appointments(therapist_id, appointment_date);

-- 3. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to appointments table
DROP TRIGGER IF EXISTS update_appointments_updated_at_trigger
    ON appointments;
CREATE TRIGGER update_appointments_updated_at_trigger
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_appointments_updated_at();

-- 4. Create view for therapist schedule
CREATE OR REPLACE VIEW therapist_schedule AS
SELECT
    a.id,
    a.patient_id,
    a.therapist_id,
    a.appointment_date,
    a.appointment_time,
    a.session_type,
    a.status,
    a.notes,
    a.meeting_link,
    u.name as patient_name,
    u.email as patient_email,
    u.profile_image as patient_image,
    t.name as therapist_name,
    t.email as therapist_email
FROM appointments a
JOIN users u ON a.patient_id = u.id
JOIN users t ON a.therapist_id = t.id
WHERE a.appointment_date >= CURRENT_DATE
ORDER BY a.appointment_date ASC, a.appointment_time ASC;

-- 5. Create view for pending appointments
CREATE OR REPLACE VIEW pending_appointments AS
SELECT
    a.id,
    a.patient_id,
    a.therapist_id,
    a.appointment_date,
    a.appointment_time,
    a.session_type,
    a.notes,
    a.created_at,
    u.name as patient_name,
    u.email as patient_email,
    u.profile_image as patient_image,
    t.name as therapist_name,
    t.email as therapist_email
FROM appointments a
JOIN users u ON a.patient_id = u.id
JOIN users t ON a.therapist_id = t.id
WHERE a.status = 'pending'
ORDER BY a.created_at DESC;

-- 6. Create view for appointment statistics
CREATE OR REPLACE VIEW appointment_statistics AS
SELECT
    therapist_id,
    COUNT(*) as total_appointments,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_count,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
    COUNT(CASE WHEN appointment_date >= CURRENT_DATE THEN 1 END) as upcoming_count,
    COUNT(CASE WHEN appointment_date = CURRENT_DATE THEN 1 END) as today_count,
    COUNT(CASE WHEN appointment_date >= DATE_TRUNC('week', CURRENT_DATE) AND appointment_date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days' THEN 1 END) as week_count
FROM appointments
GROUP BY therapist_id;

-- 7. Create function to get therapist appointment statistics
CREATE OR REPLACE FUNCTION get_therapist_appointment_stats(therapist_id_param INTEGER)
RETURNS TABLE (
    total_appointments BIGINT,
    pending_count BIGINT,
    confirmed_count BIGINT,
    completed_count BIGINT,
    upcoming_count BIGINT,
    today_count BIGINT,
    week_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(stats.total_appointments, 0),
        COALESCE(stats.pending_count, 0),
        COALESCE(stats.confirmed_count, 0),
        COALESCE(stats.completed_count, 0),
        COALESCE(stats.upcoming_count, 0),
        COALESCE(stats.today_count, 0),
        COALESCE(stats.week_count, 0)
    FROM appointment_statistics stats
    WHERE stats.therapist_id = therapist_id_param;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to check appointment availability
CREATE OR REPLACE FUNCTION check_appointment_availability(
    therapist_id_param INTEGER,
    appointment_date DATE,
    appointment_time TIME
)
RETURNS BOOLEAN AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conflict_count
    FROM appointments
    WHERE therapist_id = therapist_id_param
    AND appointment_date = appointment_date
    AND appointment_time = appointment_time
    AND status IN ('pending', 'confirmed');

    RETURN conflict_count = 0;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to get appointments for a specific week
CREATE OR REPLACE FUNCTION get_week_appointments(
    therapist_id_param INTEGER,
    week_start DATE
)
RETURNS TABLE (
    id INTEGER,
    patient_id INTEGER,
    therapist_id INTEGER,
    appointment_date DATE,
    appointment_time TIME,
    session_type VARCHAR(20),
    status VARCHAR(20),
    notes TEXT,
    patient_name TEXT,
    patient_email TEXT,
    patient_image TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.patient_id,
        a.therapist_id,
        a.appointment_date,
        a.appointment_time,
        a.session_type,
        a.status,
        a.notes,
        u.name,
        u.email,
        u.profile_image
    FROM appointments a
    JOIN users u ON a.patient_id = u.id
    WHERE a.therapist_id = therapist_id_param
    AND a.appointment_date >= week_start
    AND a.appointment_date < week_start + INTERVAL '7 days'
    ORDER BY a.appointment_date ASC, a.appointment_time ASC;
END;
$$ LANGUAGE plpgsql;

-- 10. Sample data for testing (optional - remove in production)
-- Uncomment the following lines if you want to add sample data for testing

/*
-- Sample appointments (replace IDs with actual user IDs)
INSERT INTO appointments (patient_id, therapist_id, appointment_date, appointment_time, session_type, status, notes)
VALUES
    (1, 2, CURRENT_DATE + INTERVAL '1 day', '10:00:00', 'video', 'confirmed', 'Initial consultation session'),
    (1, 2, CURRENT_DATE + INTERVAL '3 days', '14:00:00', 'in-person', 'pending', 'Follow-up session'),
    (3, 2, CURRENT_DATE + INTERVAL '2 days', '15:00:00', 'video', 'confirmed', 'Regular therapy session')
ON CONFLICT (therapist_id, appointment_date, appointment_time) DO NOTHING;
*/

-- 11. Display setup completion message
DO $$
BEGIN
    RAISE NOTICE '✅ Appointments System Setup Complete!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Tables Created:';
    RAISE NOTICE '  - appointments';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Features Added:';
    RAISE NOTICE '  - Indexes for performance';
    RAISE NOTICE '  - Triggers for timestamps';
    RAISE NOTICE '  - Views for data access';
    RAISE NOTICE '  - Functions for statistics and availability';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Next Steps:';
    RAISE NOTICE '  1. Run this SQL in your PostgreSQL database';
    RAISE NOTICE '  2. Test the appointment booking functionality';
    RAISE NOTICE '  3. Verify schedule display is working';
    RAISE NOTICE '  4. Check appointment notifications';
END $$;

-- 12. Show table structure and count
SELECT
    'appointments' as table_name,
    COUNT(*) as record_count
FROM appointments;

-- 13. Show available functions
SELECT
    'Available functions' as info,
    proname as function_name
FROM pg_proc
WHERE proname LIKE 'get_therapist_%' OR proname LIKE 'check_%' OR proname LIKE 'get_week_%'
ORDER BY proname;