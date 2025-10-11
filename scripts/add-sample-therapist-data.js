// Script to add sample therapist data with profile images
const db = require('../config/database');

async function addSampleTherapistData() {
  try {
    console.log('🚀 Adding sample therapist data...');

    // First, let's check if we have any approved therapists
    const checkTherapists = await db.query(`
      SELECT u.id, u.name, ta.status
      FROM users u
      LEFT JOIN therapist_applications ta ON u.id = ta.user_id
      WHERE u.role = 'therapist'
      LIMIT 5
    `);

    console.log(`Found ${checkTherapists.rows.length} therapists`);

    if (checkTherapists.rows.length === 0) {
      console.log('No therapists found. Please run the therapist application process first.');
      return;
    }

    // Update existing therapists with sample profile images
    for (const therapist of checkTherapists.rows) {
      if (therapist.status === 'approved' || !therapist.status) {
        // Update or insert therapist application with sample data
        const sampleBios = [
          "Licensed clinical psychologist with over 10 years of experience specializing in cognitive behavioral therapy and mindfulness-based approaches to help individuals manage stress, anxiety, and depression.",
          "Expert in relationship counseling and stress management. I help couples navigate challenges and individuals develop healthy coping strategies for life's pressures.",
          "Focuses on trauma and PTSD therapy. Offers flexible scheduling and a safe, supportive environment for healing and growth.",
          "Specializes in anxiety and depression treatment. Available for online sessions with a compassionate, evidence-based approach.",
          "Marriage and family therapist dedicated to helping families strengthen their bonds and individuals achieve personal growth."
        ];

        const sampleSpecialties = [
          "anxiety-depression",
          "couples-therapy",
          "trauma-ptsd",
          "cbt-mindfulness",
          "family-therapy"
        ];

        const sampleExperiences = [
          "8-15 years",
          "4-7 years",
          "15+ years",
          "4-7 years",
          "8-15 years"
        ];

        const randomIndex = Math.floor(Math.random() * sampleBios.length);

        // First check if application exists
        const existingApp = await db.query(
          'SELECT id FROM therapist_applications WHERE user_id = $1',
          [therapist.id]
        );

        if (existingApp.rows.length > 0) {
          // Update existing application
          await db.query(`
            UPDATE therapist_applications
            SET bio = $2, experience = $3, specialty = $4, phone = $5, status = $6, profile_image = $7, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
          `, [
            therapist.id,
            sampleBios[randomIndex],
            sampleExperiences[randomIndex],
            sampleSpecialties[randomIndex],
            '+1234567890',
            'approved',
            `optimized_user_${therapist.id}_${Date.now()}.jpeg`
          ]);
        } else {
          // Insert new application
          await db.query(`
            INSERT INTO therapist_applications (user_id, bio, experience, specialty, phone, status, profile_image)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            therapist.id,
            sampleBios[randomIndex],
            sampleExperiences[randomIndex],
            sampleSpecialties[randomIndex],
            '+1234567890',
            'approved',
            `optimized_user_${therapist.id}_${Date.now()}.jpeg`
          ]);
        }

        console.log(`✅ Updated therapist: ${therapist.name}`);
      }
    }

    console.log('🎉 Sample therapist data added successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('  - Added/updated therapist applications with sample data');
    console.log('  - Set profile images for better visual testing');
    console.log('  - Added diverse specialties and experience levels');
    console.log('');
    console.log('🔍 You can now visit /find-therapist to see the updated profiles!');

  } catch (error) {
    console.error('❌ Error adding sample therapist data:', error);
  } finally {
    await db.end();
  }
}

// Run the script
addSampleTherapistData();