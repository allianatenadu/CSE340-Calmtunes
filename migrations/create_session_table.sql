-- Migration to create session table for express-session
-- This table stores session data for user authentication

CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  PRIMARY KEY (sid)
);

-- Create index for better performance on expire column
CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);

-- Display completion message
DO $$
BEGIN
    RAISE NOTICE '✅ Session table created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Table Created:';
    RAISE NOTICE '  - session (for express-session storage)';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Features Added:';
    RAISE NOTICE '  - Session data storage for user authentication';
    RAISE NOTICE '  - Automatic session expiration support';
    RAISE NOTICE '  - JSON storage for flexible session data';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Next Steps:';
    RAISE NOTICE '  1. Run this migration in your PostgreSQL database';
    RAISE NOTICE '  2. Restart your application server';
    RAISE NOTICE '  3. Test user login/logout functionality';
    RAISE NOTICE '  4. Verify sessions persist across page reloads';
END $$;

-- Show table structure
SELECT
    'session' as table_name,
    COUNT(*) as record_count
FROM session;