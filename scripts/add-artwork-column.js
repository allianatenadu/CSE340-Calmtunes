const db = require('../config/database');

async function addArtworkColumn() {
  try {
    console.log('🚀 Adding artwork_image column to drawing_sessions table...');

    // Add the artwork_image column
    await db.query(`
      ALTER TABLE drawing_sessions
      ADD COLUMN IF NOT EXISTS artwork_image VARCHAR(255)
    `);

    console.log('✅ artwork_image column added successfully');

    // Add comment for documentation
    await db.query(`
      COMMENT ON COLUMN drawing_sessions.artwork_image IS 'Path to the saved artwork image file in public/uploads/drawings/ directory'
    `);

    console.log('✅ Column comment added');

    // Create index for better performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_drawing_sessions_artwork_image
      ON drawing_sessions(artwork_image)
      WHERE artwork_image IS NOT NULL
    `);

    console.log('✅ Index created successfully');
    console.log('🎉 Artwork column setup completed!');

  } catch (error) {
    console.error('❌ Error adding artwork column:', error);
  } finally {
    process.exit(0);
  }
}

addArtworkColumn();