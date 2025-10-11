const db = require('../config/database');

async function addSampleArtwork() {
  try {
    console.log('🎨 Adding sample artwork images to drawing sessions...');

    // Sample artwork files that should exist in public/uploads/drawings/
    const sampleImages = [
      'sample-art-1.jpg',
      'sample-art-2.jpg',
      'sample-art-3.jpg',
      'sample-art-4.jpg',
      'sample-art-5.jpg'
    ];

    // Get existing drawing sessions for user_id = 1
    const sessionsQuery = 'SELECT id FROM drawing_sessions WHERE user_id = 1 ORDER BY id LIMIT 5';
    const sessionsResult = await db.query(sessionsQuery);

    if (sessionsResult.rows.length === 0) {
      console.log('❌ No drawing sessions found for user_id = 1');
      return;
    }

    // Update each session with a sample artwork image
    for (let i = 0; i < sessionsResult.rows.length; i++) {
      const sessionId = sessionsResult.rows[i].id;
      const imageFile = sampleImages[i] || sampleImages[0];

      await db.query(
        'UPDATE drawing_sessions SET artwork_image = $1 WHERE id = $2',
        [imageFile, sessionId]
      );

      console.log(`✅ Updated session ${sessionId} with artwork: ${imageFile}`);
    }

    console.log('🎉 Sample artwork added successfully!');
    console.log('📁 Make sure these files exist in public/uploads/drawings/:');
    sampleImages.forEach(img => console.log(`   - ${img}`));

  } catch (error) {
    console.error('❌ Error adding sample artwork:', error);
  } finally {
    process.exit(0);
  }
}

addSampleArtwork();