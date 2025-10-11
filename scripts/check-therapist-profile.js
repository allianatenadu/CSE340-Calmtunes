const db = require('../config/database');

async function checkTherapistProfile() {
  try {
    console.log('🔍 Checking therapist profile images...');

    // Check therapist users and their profile images
    const query = `
      SELECT u.id, u.name, u.role, u.profile_image,
             ta.profile_image as therapist_profile_image,
             ta.specialty
      FROM users u
      LEFT JOIN therapist_applications ta ON u.id = ta.user_id
      WHERE u.role = 'therapist'
    `;

    db.query(query, (err, results) => {
      if (err) {
        console.error('❌ Database error:', err);
        return;
      }

      console.log('📋 Therapists found:', results.rows.length);
      results.rows.forEach(therapist => {
        console.log(`👤 Therapist ID ${therapist.id}:`);
        console.log(`   Name: ${therapist.name}`);
        console.log(`   User Profile Image: ${therapist.profile_image || 'NOT SET'}`);
        console.log(`   Therapist App Image: ${therapist.therapist_profile_image || 'NOT SET'}`);
        console.log(`   Specialty: ${therapist.specialty || 'NOT SET'}`);
        console.log('---');
      });

      db.end();
    });
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkTherapistProfile();