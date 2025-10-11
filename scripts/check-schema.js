const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkSchema() {
  try {
    console.log('🔍 Checking database schema...\n');

    // Check drawing_sessions table
    console.log('📋 Drawing Sessions Table:');
    const drawingResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'drawing_sessions'
      ORDER BY ordinal_position
    `);

    if (drawingResult.rows.length === 0) {
      console.log('❌ drawing_sessions table does not exist!');
    } else {
      drawingResult.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    }

    console.log('\n📋 Music Sessions Table:');
    const musicResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'music_sessions'
      ORDER BY ordinal_position
    `);

    if (musicResult.rows.length === 0) {
      console.log('❌ music_sessions table does not exist!');
    } else {
      musicResult.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    }

    console.log('\n📋 Mood Entries Table:');
    const moodResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'mood_entries'
      ORDER BY ordinal_position
    `);

    if (moodResult.rows.length === 0) {
      console.log('❌ mood_entries table does not exist!');
    } else {
      moodResult.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();