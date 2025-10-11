const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runSpecificMigration(migrationFile) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log(`🚀 Running migration: ${migrationFile}`);

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', migrationFile);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await pool.query(migrationSQL);

    console.log(`✅ Migration completed successfully: ${migrationFile}`);

  } catch (error) {
    console.error(`❌ Migration failed: ${migrationFile}`);
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the specific migration
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('❌ Please provide a migration file path');
  console.error('Usage: node scripts/run-specific-migration.js migrations/fix_password_hash_nullable.sql');
  process.exit(1);
}

runSpecificMigration(migrationFile);