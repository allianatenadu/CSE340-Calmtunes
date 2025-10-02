-- Migration to create the users table
-- This is the basic user table required for the application

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'patient' CHECK (role IN ('patient', 'therapist', 'admin')),
    profile_image VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at_trigger ON users;
CREATE TRIGGER update_users_updated_at_trigger
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_users_updated_at();

-- Display setup completion message
DO $$
BEGIN
    RAISE NOTICE '✅ Users table setup complete!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Table Created:';
    RAISE NOTICE '  - users (with role support)';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Features Added:';
    RAISE NOTICE '  - User authentication support';
    RAISE NOTICE '  - Role-based access control';
    RAISE NOTICE '  - Profile image support';
    RAISE NOTICE '  - Auto-updating timestamps';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Next Steps:';
    RAISE NOTICE '  1. Run this migration in your PostgreSQL database';
    RAISE NOTICE '  2. Create additional tables (conversations, etc.)';
    RAISE NOTICE '  3. Test user registration and login';
END $$;

-- Show table structure and count
SELECT
    'users' as table_name,
    COUNT(*) as record_count
FROM users;