const db = require('../config/database');

async function fixTherapistImageFilename() {
  try {
    console.log('🔧 Fixing therapist profile image filename...');

    // The correct filenames that actually exist in the uploads folder
    const correctImageName = 'optimized_user_3_1757275014540.jpg';
    const correctPatientImageName = 'optimized_user_1_1757438739635.jpg';

    // Fix any remaining .jpeg extensions to .jpg
    console.log('🔧 Fixing file extensions from .jpeg to .jpg...');

    // Fix any remaining .jpeg extensions to .jpg
    console.log('🔧 Fixing file extensions from .jpeg to .jpg...');

    // Wrong filenames that need to be fixed
    const wrongFilenames = [
      'optimized_user_3_1760086469546.jpeg',
      'optimized_user_13_1760086470173.jpeg',
      'optimized_user_17_1760086470895.jpeg'
    ];

    // Fix users table - update wrong therapist filenames
    db.query('UPDATE users SET profile_image = $1 WHERE profile_image = ANY($2)',
      [correctImageName, wrongFilenames],
      (err, results) => {
        if (err) {
          console.error('❌ Users table update error:', err);
        } else {
          console.log(`✅ Updated ${results.rowCount} users with correct profile image: ${correctImageName}`);
        }

        // Fix patient image extension
        db.query('UPDATE users SET profile_image = $1 WHERE profile_image = $2',
          [correctPatientImageName, 'optimized_user_1_1757438739635.jpeg'],
          (err, results) => {
            if (err) {
              console.error('❌ Patient image update error:', err);
            } else {
              console.log(`✅ Updated ${results.rowCount} patient images with correct extension: ${correctPatientImageName}`);
            }

            // Fix therapist_applications table
            db.query('UPDATE therapist_applications SET profile_image = $1 WHERE profile_image = ANY($2)',
              [correctImageName, wrongFilenames],
              (err, results) => {
                if (err) {
                  console.error('❌ Therapist applications update error:', err);
                } else {
                  console.log(`✅ Updated ${results.rowCount} therapist applications with correct profile image`);
                }

                // Verify the fix
                db.query(`
                  SELECT u.id, u.name, u.profile_image,
                         ta.profile_image as therapist_app_image
                  FROM users u
                  LEFT JOIN therapist_applications ta ON u.id = ta.user_id
                  WHERE u.role = $1
                `, ['therapist'], (err, results) => {
                  if (err) {
                    console.error('❌ Verification error:', err);
                    return;
                  }

                  console.log('📋 Updated therapists:');
                  results.rows.forEach(therapist => {
                    console.log(`   ID ${therapist.id}: ${therapist.name}`);
                    console.log(`     User profile_image: ${therapist.profile_image}`);
                    console.log(`     Therapist app image: ${therapist.therapist_app_image}`);
                  });

                  console.log('🎉 Therapist profile image filename fixed!');
                  console.log('💡 Now patient users should see therapist profile pictures correctly');

                  db.end();
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

fixTherapistImageFilename();