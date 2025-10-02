const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Create database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('🚀 Starting database migration...');

    // Step 1: Create users table
    console.log('📋 Step 1: Creating users table...');
    const usersMigrationPath = path.join(__dirname, '..', 'migrations', 'create_users_table.sql');
    const usersMigrationSQL = fs.readFileSync(usersMigrationPath, 'utf8');
    await pool.query(usersMigrationSQL);
    console.log('✅ Users table created successfully');

    // Step 2: Create unified conversations tables
    console.log('📋 Step 2: Creating unified conversations tables...');
    const conversationsMigrationPath = path.join(__dirname, '..', 'migrations', 'create_unified_conversations.sql');
    const conversationsMigrationSQL = fs.readFileSync(conversationsMigrationPath, 'utf8');
    await pool.query(conversationsMigrationSQL);
    console.log('✅ Unified conversations tables created successfully');

    console.log('🎉 All migrations completed successfully!');
    console.log('📋 Created tables:');
    console.log('  - users');
    console.log('  - conversations');
    console.log('  - messages');
    console.log('  - indexes and triggers');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();