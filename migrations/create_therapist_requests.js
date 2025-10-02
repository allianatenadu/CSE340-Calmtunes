const db = require('../config/database');

const createTherapistRequestsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS therapist_requests (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        therapist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        responded_at TIMESTAMP WITH TIME ZONE,
        UNIQUE(patient_id, therapist_id, status)
      );

      CREATE INDEX IF NOT EXISTS idx_therapist_requests_patient_id ON therapist_requests(patient_id);
      CREATE INDEX IF NOT EXISTS idx_therapist_requests_therapist_id ON therapist_requests(therapist_id);
      CREATE INDEX IF NOT EXISTS idx_therapist_requests_status ON therapist_requests(status);
    `;

    await db.query(query);
    console.log('✅ Therapist requests table created successfully');
  } catch (error) {
    console.error('❌ Error creating therapist requests table:', error);
    throw error;
  }
};

const createTherapistPatientRelationshipsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS therapist_patient_relationships (
        id SERIAL PRIMARY KEY,
        therapist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'ended')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(therapist_id, patient_id)
      );

      CREATE INDEX IF NOT EXISTS idx_therapist_patient_relationships_therapist_id ON therapist_patient_relationships(therapist_id);
      CREATE INDEX IF NOT EXISTS idx_therapist_patient_relationships_patient_id ON therapist_patient_relationships(patient_id);
      CREATE INDEX IF NOT EXISTS idx_therapist_patient_relationships_status ON therapist_patient_relationships(status);
    `;

    await db.query(query);
    console.log('✅ Therapist-patient relationships table created successfully');
  } catch (error) {
    console.error('❌ Error creating therapist-patient relationships table:', error);
    throw error;
  }
};

const createNotificationsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
      CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
    `;

    await db.query(query);
    console.log('✅ Notifications table created successfully');
  } catch (error) {
    console.error('❌ Error creating notifications table:', error);
    throw error;
  }
};

const runMigrations = async () => {
  try {
    console.log('🚀 Starting therapist requests system migrations...');

    await createTherapistRequestsTable();
    await createTherapistPatientRelationshipsTable();
    await createNotificationsTable();

    console.log('✅ All migrations completed successfully!');
    console.log('📋 Migration Summary:');
    console.log('  - therapist_requests table: ✓ Created');
    console.log('  - therapist_patient_relationships table: ✓ Created');
    console.log('  - notifications table: ✓ Created');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('  1. Run this migration in your database');
    console.log('  2. Test the therapist request functionality');
    console.log('  3. Create the notifications page UI');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = {
  createTherapistRequestsTable,
  createTherapistPatientRelationshipsTable,
  createNotificationsTable,
  runMigrations
};