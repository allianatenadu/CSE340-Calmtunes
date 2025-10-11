const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Create database connection for local development
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'calmtunes',
  port: process.env.DB_PORT || 5432,
});

async function setupMoodTracker() {
  try {
    console.log('🚀 Setting up mood tracker database...');

    // First, ensure users table exists (basic structure)
    console.log('📋 Creating users table if not exists...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'patient',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table ready');

    // Create mood_entries table
    console.log('📋 Creating mood_entries table...');
    const moodEntriesSQL = fs.readFileSync(
      path.join(__dirname, '..', 'migrations', 'create_mood_entries_table.sql'),
      'utf8'
    );
    await pool.query(moodEntriesSQL);
    console.log('✅ Mood entries table created successfully');

    // Create a test user for demonstration
    console.log('📋 Creating test user...');
    const { rows: existingUsers } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['test@example.com']
    );

    if (existingUsers.length === 0) {
      const { rows: newUser } = await pool.query(`
        INSERT INTO users (email, first_name, last_name, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, ['test@example.com', 'Test', 'User', 'patient']);

      console.log(`✅ Test user created with ID: ${newUser[0].id}`);

      // Add some sample mood data
      console.log('📋 Adding sample mood data...');
      const sampleMoods = [
        { mood: 'Happy', energy: 8, note: 'Had a great day at work!' },
        { mood: 'Calm', energy: 6, note: 'Peaceful evening with music' },
        { mood: 'Neutral', energy: 5, note: 'Regular day' },
        { mood: 'Sad', energy: 3, note: 'Feeling a bit down today' },
        { mood: 'Happy', energy: 9, note: 'Great workout session' },
        { mood: 'Calm', energy: 7, note: 'Meditated this morning' },
        { mood: 'Anxious', energy: 4, note: 'Work presentation tomorrow' }
      ];

      for (const sample of sampleMoods) {
        await pool.query(`
          INSERT INTO mood_entries (user_id, mood, energy, note, entry_date)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP - INTERVAL '${Math.floor(Math.random() * 7)} days')
        `, [newUser[0].id, sample.mood, sample.energy, sample.note]);
      }

      console.log(`✅ Added ${sampleMoods.length} sample mood entries`);
    } else {
      console.log('✅ Test user already exists');
    }

    console.log('🎉 Mood tracker setup completed successfully!');
    console.log('📋 Summary:');
    console.log('  - Users table: ✅ Ready');
    console.log('  - Mood entries table: ✅ Ready');
    console.log('  - Sample data: ✅ Added');
    console.log('  - Test user: test@example.com');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupMoodTracker();