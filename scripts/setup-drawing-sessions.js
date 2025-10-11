const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Create database connection using DATABASE_URL for production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function setupDrawingSessions() {
  try {
    console.log('🎨 Setting up drawing sessions database...');

    // First, ensure users table exists (basic structure)
    console.log('📋 Creating users table if not exists...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        name VARCHAR(255),
        role VARCHAR(20) DEFAULT 'patient',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table ready');

    // Create drawing_sessions table
    console.log('📋 Creating drawing_sessions table...');
    const drawingSessionsSQL = fs.readFileSync(
      path.join(__dirname, '..', 'migrations', 'create_drawing_sessions.sql'),
      'utf8'
    );
    await pool.query(drawingSessionsSQL);
    console.log('✅ Drawing sessions table created successfully');

    // Get or create test users
    console.log('📋 Setting up test users...');
    const testUsers = [
      { email: 'patient1@example.com', name: 'John Patient', role: 'patient' },
      { email: 'patient2@example.com', name: 'Jane Patient', role: 'patient' }
    ];

    const userIds = [];
    for (const user of testUsers) {
      const { rows: existingUsers } = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [user.email]
      );

      if (existingUsers.length === 0) {
        const { rows: newUser } = await pool.query(`
          INSERT INTO users (email, name, role)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [user.email, user.name, user.role]);
        userIds.push(newUser[0].id);
        console.log(`✅ Created user: ${user.name} (ID: ${newUser[0].id})`);
      } else {
        userIds.push(existingUsers[0].id);
        console.log(`✅ User already exists: ${user.name} (ID: ${existingUsers[0].id})`);
      }
    }

    // Add sample drawing sessions for each user
    console.log('📋 Adding sample drawing sessions...');

    const artTypes = ['free_draw', 'mandala', 'guided_meditation', 'emotion_expression', 'stress_relief'];
    const moodStates = ['very_stressed', 'stressed', 'neutral', 'calm', 'very_calm'];

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      const sessionsCount = Math.floor(Math.random() * 5) + 3; // 3-7 sessions per user

      for (let j = 0; j < sessionsCount; j++) {
        const moodBefore = moodStates[Math.floor(Math.random() * moodStates.length)];
        const moodAfterIndex = Math.max(0, moodStates.indexOf(moodBefore) + (Math.floor(Math.random() * 2) - 1));
        const moodAfter = moodStates[moodAfterIndex] || 'calm';

        await pool.query(`
          INSERT INTO drawing_sessions (
            user_id, session_name, art_type, duration, mood_before, mood_after,
            tools_used, colors_used, canvas_size, is_completed, session_date
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          userId,
          `Art Session ${j + 1}`,
          artTypes[Math.floor(Math.random() * artTypes.length)],
          Math.floor(Math.random() * 30) + 15, // 15-45 minutes
          moodBefore,
          moodAfter,
          JSON.stringify(['brush', 'pencil', 'eraser']),
          JSON.stringify(['blue', 'green', 'yellow', 'red']),
          '800x600',
          true,
          new Date(Date.now() - (Math.random() * 7 * 24 * 60 * 60 * 1000)) // Random date within last 7 days
        ]);
      }

      console.log(`✅ Added ${sessionsCount} drawing sessions for user ${i + 1}`);
    }

    console.log('🎉 Drawing sessions setup completed successfully!');
    console.log('📋 Summary:');
    console.log('  - Users table: ✅ Ready');
    console.log('  - Drawing sessions table: ✅ Ready');
    console.log('  - Sample data: ✅ Added');
    console.log(`  - Test users: ${testUsers.map(u => u.email).join(', ')}`);

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupDrawingSessions();