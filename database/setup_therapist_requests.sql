-- =============================================
-- CALMTUNES - THERAPIST REQUESTS & NOTIFICATIONS SYSTEM
-- Complete SQL Setup for New Features
-- =============================================

-- 1. Add bio field to users table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'bio') THEN
        ALTER TABLE users ADD COLUMN bio TEXT;
        COMMENT ON COLUMN users.bio IS 'User biography - mandatory for therapists';
    END IF;
END $$;

-- 2. Create therapist_requests table
CREATE TABLE IF NOT EXISTS therapist_requests (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    therapist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(patient_id, therapist_id, status)
);

-- Add comments
COMMENT ON TABLE therapist_requests IS 'Stores patient requests to specific therapists';
COMMENT ON COLUMN therapist_requests.patient_id IS 'ID of the patient making the request';
COMMENT ON COLUMN therapist_requests.therapist_id IS 'ID of the therapist being requested';
COMMENT ON COLUMN therapist_requests.status IS 'Request status: pending, approved, rejected';

-- 3. Create therapist_patient_relationships table
CREATE TABLE IF NOT EXISTS therapist_patient_relationships (
    id SERIAL PRIMARY KEY,
    therapist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'ended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(therapist_id, patient_id)
);

-- Add comments
COMMENT ON TABLE therapist_patient_relationships IS 'Active relationships between therapists and patients';
COMMENT ON COLUMN therapist_patient_relationships.therapist_id IS 'ID of the therapist';
COMMENT ON COLUMN therapist_patient_relationships.patient_id IS 'ID of the patient';
COMMENT ON COLUMN therapist_patient_relationships.status IS 'Relationship status: active, inactive, ended';

-- 4. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add comments
COMMENT ON TABLE notifications IS 'System notifications for users';
COMMENT ON COLUMN notifications.user_id IS 'ID of the user receiving the notification';
COMMENT ON COLUMN notifications.type IS 'Notification type: therapist_request, request_approved, request_rejected, appointment, etc.';
COMMENT ON COLUMN notifications.title IS 'Notification title';
COMMENT ON COLUMN notifications.message IS 'Notification message content';
COMMENT ON COLUMN notifications.is_read IS 'Whether the notification has been read';

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_therapist_requests_patient_id
    ON therapist_requests(patient_id);

CREATE INDEX IF NOT EXISTS idx_therapist_requests_therapist_id
    ON therapist_requests(therapist_id);

CREATE INDEX IF NOT EXISTS idx_therapist_requests_status
    ON therapist_requests(status);

CREATE INDEX IF NOT EXISTS idx_therapist_requests_created_at
    ON therapist_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_therapist_patient_relationships_therapist_id
    ON therapist_patient_relationships(therapist_id);

CREATE INDEX IF NOT EXISTS idx_therapist_patient_relationships_patient_id
    ON therapist_patient_relationships(patient_id);

CREATE INDEX IF NOT EXISTS idx_therapist_patient_relationships_status
    ON therapist_patient_relationships(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_type
    ON notifications(type);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read
    ON notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
    ON notifications(created_at);

-- 6. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to therapist_patient_relationships table
DROP TRIGGER IF EXISTS update_therapist_patient_relationships_updated_at
    ON therapist_patient_relationships;
CREATE TRIGGER update_therapist_patient_relationships_updated_at
    BEFORE UPDATE ON therapist_patient_relationships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Create view for active therapist-patient relationships
CREATE OR REPLACE VIEW active_therapist_relationships AS
SELECT
    tpr.id,
    tpr.therapist_id,
    tpr.patient_id,
    tpr.created_at,
    t.name as therapist_name,
    t.email as therapist_email,
    u.name as patient_name,
    u.email as patient_email
FROM therapist_patient_relationships tpr
JOIN users t ON tpr.therapist_id = t.id
JOIN users u ON tpr.patient_id = u.id
WHERE tpr.status = 'active';

-- 8. Create view for pending therapist requests
CREATE OR REPLACE VIEW pending_therapist_requests AS
SELECT
    tr.id,
    tr.patient_id,
    tr.therapist_id,
    tr.created_at,
    p.name as patient_name,
    p.email as patient_email,
    t.name as therapist_name,
    t.email as therapist_email
FROM therapist_requests tr
JOIN users p ON tr.patient_id = p.id
JOIN users t ON tr.therapist_id = t.id
WHERE tr.status = 'pending';

-- 9. Create function to get user notification count
CREATE OR REPLACE FUNCTION get_user_notification_count(user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    count INTEGER;
BEGIN
    SELECT COUNT(*) INTO count
    FROM notifications
    WHERE notifications.user_id = user_id AND is_read = FALSE;

    RETURN count;
END;
$$ LANGUAGE plpgsql;

-- 10. Create function to create therapist request notification
CREATE OR REPLACE FUNCTION notify_therapist_request(
    therapist_id INTEGER,
    patient_name TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO notifications (user_id, type, title, message, created_at)
    VALUES (
        therapist_id,
        'therapist_request',
        'New Patient Request',
        'A patient has requested you as their therapist. Please review and respond.',
        CURRENT_TIMESTAMP
    );
END;
$$ LANGUAGE plpgsql;

-- 11. Create function to notify request approval
CREATE OR REPLACE FUNCTION notify_request_approved(
    patient_id INTEGER,
    therapist_name TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO notifications (user_id, type, title, message, created_at)
    VALUES (
        patient_id,
        'request_approved',
        'Therapist Request Approved',
        'Your therapist request has been approved! You can now schedule appointments.',
        CURRENT_TIMESTAMP
    );
END;
$$ LANGUAGE plpgsql;

-- 12. Create function to notify request rejection
CREATE OR REPLACE FUNCTION notify_request_rejected(
    patient_id INTEGER,
    therapist_name TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO notifications (user_id, type, title, message, created_at)
    VALUES (
        patient_id,
        'request_rejected',
        'Therapist Request Update',
        'Your therapist request was not approved at this time. You can try requesting another therapist.',
        CURRENT_TIMESTAMP
    );
END;
$$ LANGUAGE plpgsql;

-- 13. Sample data for testing (optional - remove in production)
-- Uncomment the following lines if you want to add sample data for testing

/*
-- Sample therapist with bio
UPDATE users
SET bio = 'I am a licensed clinical psychologist with over 8 years of experience helping individuals overcome anxiety, depression, and relationship challenges. My approach combines cognitive-behavioral therapy with mindfulness techniques to help clients develop lasting coping strategies and achieve their mental health goals.'
WHERE id = 1 AND role = 'therapist';

-- Sample patient
INSERT INTO users (name, email, role, created_at)
VALUES ('John Doe', 'john.doe@email.com', 'patient', CURRENT_TIMESTAMP)
ON CONFLICT (email) DO NOTHING;

-- Sample therapist request (replace IDs with actual user IDs)
INSERT INTO therapist_requests (patient_id, therapist_id, status, created_at)
VALUES (1, 2, 'pending', CURRENT_TIMESTAMP)
ON CONFLICT (patient_id, therapist_id, status) DO NOTHING;
*/

-- 14. Display setup completion message
DO $$
BEGIN
    RAISE NOTICE '✅ Therapist Requests & Notifications System Setup Complete!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Tables Created:';
    RAISE NOTICE '  - therapist_requests';
    RAISE NOTICE '  - therapist_patient_relationships';
    RAISE NOTICE '  - notifications';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Features Added:';
    RAISE NOTICE '  - Bio field for users table';
    RAISE NOTICE '  - Indexes for performance';
    RAISE NOTICE '  - Triggers for timestamps';
    RAISE NOTICE '  - Views for data access';
    RAISE NOTICE '  - Functions for notifications';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Next Steps:';
    RAISE NOTICE '  1. Run this SQL in your PostgreSQL database';
    RAISE NOTICE '  2. Test the therapist request functionality';
    RAISE NOTICE '  3. Verify notifications are working';
    RAISE NOTICE '  4. Check bio validation in admin approval';
END $$;

-- 15. Show table structures
SELECT
    'therapist_requests' as table_name,
    COUNT(*) as record_count
FROM therapist_requests
UNION ALL
SELECT
    'therapist_patient_relationships' as table_name,
    COUNT(*) as record_count
FROM therapist_patient_relationships
UNION ALL
SELECT
    'notifications' as table_name,
    COUNT(*) as record_count
FROM notifications;

-- 16. Show bio field in users table
SELECT
    'users table bio field' as info,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'users' AND column_name = 'bio')
        THEN '✅ Bio field exists'
        ELSE '❌ Bio field missing'
    END as status;