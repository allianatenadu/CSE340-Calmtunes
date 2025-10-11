const db = require('../config/database');

async function runEnhancedMigration() {
  try {
    console.log('🚀 Running comprehensive database migration...');

    const fs = require('fs');
    const path = require('path');

    // List of all migration files to run
    const migrations = [
      { name: 'Drawing Sessions SQL', file: 'create_drawing_sessions.sql', type: 'sql' },
      { name: 'Music Sessions SQL', file: 'create_music_sessions.sql', type: 'sql' },
      { name: 'Mood Entries SQL', file: 'create_mood_entries.sql', type: 'sql' },
      { name: 'Panic Sessions SQL', file: 'create_panic_sessions.sql', type: 'sql' },
      { name: 'Appointments', file: 'create_appointments_table.sql', type: 'sql' },
      { name: 'Therapist Requests', file: 'create_therapist_requests.js', type: 'sequelize' },
      { name: 'Enhanced Messages', file: 'enhance_messages_table.sql', type: 'sql' }
    ];

    for (const migration of migrations) {
      try {
        console.log(`📋 Running ${migration.name} migration...`);

        const migrationPath = path.join(__dirname, '..', 'migrations', migration.file);

        if (migration.type === 'sequelize') {
          // Handle JavaScript migration files (Sequelize)
          console.log(`⚠️ Skipping Sequelize migration: ${migration.file} (requires queryInterface)`);
          console.log(`💡 Please run this manually or use Sequelize CLI`);
        } else if (migration.type === 'sql') {
          // Handle SQL migration files
          if (fs.existsSync(migrationPath)) {
            const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
            await db.query(migrationSQL);
            console.log(`✅ ${migration.name} migration completed successfully`);
          } else {
            console.log(`⚠️ Migration file not found: ${migration.file}`);
          }
        }

      } catch (error) {
        console.error(`❌ ${migration.name} migration failed:`, error.message);
        // Continue with other migrations even if one fails
      }
    }

    console.log('🎉 Migration process completed!');
    console.log('📋 Summary:');
    console.log('  - Some tables may need manual creation via Sequelize CLI');
    console.log('  - Or run individual SQL files as needed');

  } catch (error) {
    console.error('❌ Migration process failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

runEnhancedMigration();