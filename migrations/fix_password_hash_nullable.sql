-- Migration to make password_hash nullable for social auth users
-- This allows users created via Google/Spotify OAuth to not have a password_hash

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.password_hash IS 'Password hash for regular users. NULL for social auth users (Google, Spotify)';

-- Display completion message
DO $$
BEGIN
    RAISE NOTICE '✅ Password hash field updated successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Changes Made:';
    RAISE NOTICE '  - password_hash column is now nullable';
    RAISE NOTICE '  - Social auth users can now be created without password_hash';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Next Steps:';
    RAISE NOTICE '  1. Run this migration in your PostgreSQL database';
    RAISE NOTICE '  2. Test social authentication (Google/Spotify signup)';
    RAISE NOTICE '  3. Verify regular signup still works with password_hash';
END $$;