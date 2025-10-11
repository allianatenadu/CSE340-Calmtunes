const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Create database connection using DATABASE_URL for production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function setupMusicSessions() {
  try {
    console.log('🎵 Setting up music sessions database...');

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

    // Create music_sessions table
    console.log('📋 Creating music_sessions table...');
    const musicSessionsSQL = fs.readFileSync(
      path.join(__dirname, '..', 'migrations', 'create_music_sessions.sql'),
      'utf8'
    );
    await pool.query(musicSessionsSQL);
    console.log('✅ Music sessions table created successfully');

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

    // Add sample music sessions for each user
    console.log('📋 Adding sample music sessions...');

    const categories = ['calm', 'energetic', 'meditation', 'nature', 'classical', 'ambient', 'focus', 'sleep'];
    const sampleSongs = [
      { title: 'Weightless', artist: 'Marconi Union', category: 'calm' },
      { title: 'Clair de Lune', artist: 'Debussy', category: 'classical' },
      { title: 'Forest Sounds', artist: 'Nature Recordings', category: 'nature' },
      { title: 'Deep Meditation', artist: 'Zen Music', category: 'meditation' },
      { title: 'Ocean Waves', artist: 'Relaxation Audio', category: 'ambient' },
      { title: 'Morning Energy', artist: 'Upbeat Mix', category: 'energetic' },
      { title: 'Focus Flow', artist: 'Concentration Music', category: 'focus' },
      { title: 'Sleep Journey', artist: 'Dream Sounds', category: 'sleep' },
      { title: 'Peaceful Mind', artist: 'Serenity Spa', category: 'calm' },
      { title: 'Mountain Stream', artist: 'Nature Ambience', category: 'nature' }
    ];

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      const sessionsCount = Math.floor(Math.random() * 8) + 5; // 5-12 sessions per user

      for (let j = 0; j < sessionsCount; j++) {
        const randomSong = sampleSongs[Math.floor(Math.random() * sampleSongs.length)];
        const moodBefore = ['very_low', 'low', 'neutral', 'good', 'excellent'][Math.floor(Math.random() * 5)];
        const moodAfterIndex = Math.min(4, Math.max(0, ['very_low', 'low', 'neutral', 'good', 'excellent'].indexOf(moodBefore) + (Math.floor(Math.random() * 3) - 1)));
        const moodAfter = ['very_low', 'low', 'neutral', 'good', 'excellent'][moodAfterIndex];

        await pool.query(`
          INSERT INTO music_sessions (
            user_id, title, artist, category, duration, playlist_name,
            mood_before, mood_after, spotify_track_id, session_date
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          userId,
          randomSong.title,
          randomSong.artist,
          randomSong.category,
          Math.floor(Math.random() * 300) + 180, // 3-8 minutes
          `My Playlist ${Math.floor(Math.random() * 5) + 1}`,
          moodBefore,
          moodAfter,
          `spotify:track:${Math.random().toString(36).substring(2, 15)}`,
          new Date(Date.now() - (Math.random() * 14 * 24 * 60 * 60 * 1000)) // Random date within last 14 days
        ]);
      }

      console.log(`✅ Added ${sessionsCount} music sessions for user ${i + 1}`);
    }

    console.log('🎉 Music sessions setup completed successfully!');
    console.log('📋 Summary:');
    console.log('  - Users table: ✅ Ready');
    console.log('  - Music sessions table: ✅ Ready');
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
setupMusicSessions();