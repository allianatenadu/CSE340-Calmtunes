// Add test data for patient ID 1 (Alliana Tenadu) so therapist can see all sections
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function addTestDataForPatient1() {
  try {
    console.log('🎨 Adding test data for patient ID 1...\n');

    // Add drawing sessions for patient 1
    console.log('📝 Adding drawing sessions...');
    const drawingSessions = [
      {
        user_id: 1,
        session_name: 'Stress Relief Session',
        art_type: 'mandala',
        duration: 25,
        mood_before: 'stressed',
        mood_after: 'calm',
        tools_used: JSON.stringify(['brush', 'pencil']),
        colors_used: JSON.stringify(['blue', 'green', 'purple']),
        canvas_size: '800x600',
        is_completed: true,
        session_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      },
      {
        user_id: 1,
        session_name: 'Emotion Expression',
        art_type: 'emotion_expression',
        duration: 30,
        mood_before: 'very_stressed',
        mood_after: 'neutral',
        tools_used: JSON.stringify(['brush', 'eraser']),
        colors_used: JSON.stringify(['red', 'black', 'yellow']),
        canvas_size: '800x600',
        is_completed: true,
        session_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      }
    ];

    for (const session of drawingSessions) {
      await pool.query(`
        INSERT INTO drawing_sessions
        (user_id, session_name, art_type, duration, mood_before, mood_after,
         tools_used, colors_used, canvas_size, is_completed, session_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        session.user_id, session.session_name, session.art_type, session.duration,
        session.mood_before, session.mood_after, session.tools_used, session.colors_used,
        session.canvas_size, session.is_completed, session.session_date
      ]);
    }
    console.log(`✅ Added ${drawingSessions.length} drawing sessions`);

    // Add music sessions for patient 1
    console.log('🎵 Adding music sessions...');
    const musicSessions = [
      {
        user_id: 1,
        title: 'Weightless',
        artist: 'Marconi Union',
        category: 'ambient',
        duration: 480,
        playlist_name: 'Calm & Relaxing',
        mood_before: 'low',
        mood_after: 'good',
        spotify_track_id: 'spotify:track:123456789',
        session_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
      },
      {
        user_id: 1,
        title: 'Clair de Lune',
        artist: 'Claude Debussy',
        category: 'classical',
        duration: 300,
        playlist_name: 'Peaceful Piano',
        mood_before: 'neutral',
        mood_after: 'excellent',
        spotify_track_id: 'spotify:track:987654321',
        session_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
      },
      {
        user_id: 1,
        title: 'River Flows in You',
        artist: 'Yiruma',
        category: 'meditation',
        duration: 180,
        playlist_name: 'Meditation Music',
        mood_before: 'very_low',
        mood_after: 'good',
        spotify_track_id: 'spotify:track:456789123',
        session_date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // 4 days ago
      }
    ];

    for (const session of musicSessions) {
      await pool.query(`
        INSERT INTO music_sessions
        (user_id, title, artist, category, duration, playlist_name,
         mood_before, mood_after, spotify_track_id, session_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        session.user_id, session.title, session.artist, session.category,
        session.duration, session.playlist_name, session.mood_before,
        session.mood_after, session.spotify_track_id, session.session_date
      ]);
    }
    console.log(`✅ Added ${musicSessions.length} music sessions`);

    // Add some mood entries for patient 1 (if not enough exist)
    console.log('💭 Checking mood entries...');
    const moodCount = await pool.query('SELECT COUNT(*) as count FROM mood_entries WHERE user_id = $1', [1]);
    if (parseInt(moodCount.rows[0].count) < 5) {
      const moodEntries = [
        {
          user_id: 1,
          mood_level: 7,
          mood_intensity: 3,
          note: 'Feeling good after morning meditation',
          triggers: 'Work stress',
          activities: 'Meditation, Exercise',
          created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        },
        {
          user_id: 1,
          mood_level: 5,
          mood_intensity: 2,
          note: 'Anxious about upcoming presentation',
          triggers: 'Work deadline',
          activities: 'Deep breathing',
          created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
        }
      ];

      for (const entry of moodEntries) {
        await pool.query(`
          INSERT INTO mood_entries
          (user_id, mood_level, mood_intensity, note, triggers, activities, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          entry.user_id, entry.mood_level, entry.mood_intensity, entry.note,
          entry.triggers, entry.activities, entry.created_at
        ]);
      }
      console.log(`✅ Added ${moodEntries.length} mood entries`);
    } else {
      console.log(`✅ Patient already has ${moodCount.rows[0].count} mood entries`);
    }

    console.log('\n🎉 Test data added successfully!');
    console.log('📋 Summary for Patient ID 1:');
    console.log('  - Drawing sessions: 2');
    console.log('  - Music sessions: 3');
    console.log('  - Mood entries: Multiple');
    console.log('  - Panic sessions: Existing');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

addTestDataForPatient1();