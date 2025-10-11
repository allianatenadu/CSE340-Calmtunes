// verify-patient-data.js
// Run this script to check if data exists: node verify-patient-data.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function verifyPatientData() {
  try {
    console.log('🔍 Checking patient data in database...\n');

    // Check users
    const usersResult = await pool.query('SELECT id, name, email, role FROM users WHERE role = $1 LIMIT 5', ['patient']);
    console.log('👥 Sample Patients:');
    usersResult.rows.forEach(user => {
      console.log(`  - ID: ${user.id}, Name: ${user.name}, Email: ${user.email}`);
    });
    console.log('');

    if (usersResult.rows.length === 0) {
      console.log('⚠️ No patients found in database!');
      return;
    }

    const patientId = usersResult.rows[0].id;
    console.log(`📊 Checking data for patient ID: ${patientId}\n`);

    // Check drawing sessions
    const drawingsCount = await pool.query('SELECT COUNT(*) as count FROM drawing_sessions WHERE user_id = $1', [patientId]);
    console.log(`🎨 Drawing Sessions: ${drawingsCount.rows[0].count}`);

    if (drawingsCount.rows[0].count > 0) {
      const sampleDrawing = await pool.query('SELECT * FROM drawing_sessions WHERE user_id = $1 LIMIT 1', [patientId]);
      console.log('   Sample:', JSON.stringify(sampleDrawing.rows[0], null, 2));
    }
    console.log('');

    // Check music sessions
    const musicCount = await pool.query('SELECT COUNT(*) as count FROM music_sessions WHERE user_id = $1', [patientId]);
    console.log(`🎵 Music Sessions: ${musicCount.rows[0].count}`);

    if (musicCount.rows[0].count > 0) {
      const sampleMusic = await pool.query('SELECT * FROM music_sessions WHERE user_id = $1 LIMIT 1', [patientId]);
      console.log('   Sample:', JSON.stringify(sampleMusic.rows[0], null, 2));
    }
    console.log('');

    // Check mood entries
    const moodCount = await pool.query('SELECT COUNT(*) as count FROM mood_entries WHERE user_id = $1', [patientId]);
    console.log(`💭 Mood Entries: ${moodCount.rows[0].count}`);

    if (moodCount.rows[0].count > 0) {
      const sampleMood = await pool.query('SELECT * FROM mood_entries WHERE user_id = $1 LIMIT 1', [patientId]);
      console.log('   Sample:', JSON.stringify(sampleMood.rows[0], null, 2));
    }
    console.log('');

    // Check panic sessions
    const panicCount = await pool.query('SELECT COUNT(*) as count FROM panic_sessions WHERE user_id = $1', [patientId]);
    console.log(`🚨 Panic Sessions: ${panicCount.rows[0].count}`);

    if (panicCount.rows[0].count > 0) {
      const samplePanic = await pool.query('SELECT * FROM panic_sessions WHERE user_id = $1 LIMIT 1', [patientId]);
      console.log('   Sample:', JSON.stringify(samplePanic.rows[0], null, 2));
    }
    console.log('');

    // Summary
    console.log('📋 Summary:');
    console.log(`  - Total drawings for patient ${patientId}: ${drawingsCount.rows[0].count}`);
    console.log(`  - Total music sessions for patient ${patientId}: ${musicCount.rows[0].count}`);
    console.log(`  - Total mood entries for patient ${patientId}: ${moodCount.rows[0].count}`);
    console.log(`  - Total panic sessions for patient ${patientId}: ${panicCount.rows[0].count}`);

    // Check if tables exist but are empty for ALL users
    console.log('\n🗄️ Database-wide statistics:');
    const allDrawings = await pool.query('SELECT COUNT(*) as count FROM drawing_sessions');
    const allMusic = await pool.query('SELECT COUNT(*) as count FROM music_sessions');
    const allMood = await pool.query('SELECT COUNT(*) as count FROM mood_entries');
    const allPanic = await pool.query('SELECT COUNT(*) as count FROM panic_sessions');

    console.log(`  - Total drawings (all users): ${allDrawings.rows[0].count}`);
    console.log(`  - Total music sessions (all users): ${allMusic.rows[0].count}`);
    console.log(`  - Total mood entries (all users): ${allMood.rows[0].count}`);
    console.log(`  - Total panic sessions (all users): ${allPanic.rows[0].count}`);

    if (allDrawings.rows[0].count === '0' && allMusic.rows[0].count === '0') {
      console.log('\n⚠️ ISSUE FOUND: Tables are empty!');
      console.log('💡 Solution: Run the setup scripts to populate data:');
      console.log('   - node setup-drawing-sessions.js');
      console.log('   - node setup-music-sessions.js');
      console.log('   - node setup-mood-tracker.js');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

verifyPatientData();