const { Client } = require('pg');
require('dotenv').config();

async function setTherapistProfileImage() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check current therapists
    const therapists = await client.query('SELECT id, name, profile_image FROM users WHERE role = $1', ['therapist']);
    console.log('Current therapists:');
    therapists.rows.forEach(row => {
      console.log(`ID: ${row.id}, Name: ${row.name}, Profile Image: ${row.profile_image}`);
    });

    // Set profile image for all therapists found - use correct filename
    for (const therapist of therapists.rows) {
      if (therapist.id) {
        // Use the correct filename that actually exists in the uploads folder
        const correctImageName = 'optimized_user_3_1757275014540.jpg';
        await client.query('UPDATE users SET profile_image = $1 WHERE id = $2', [correctImageName, therapist.id]);
        console.log(`✅ Updated therapist ID ${therapist.id} (${therapist.name}) with correct profile image: ${correctImageName}`);
      }
    }

    // Verify the update
    const updated = await client.query('SELECT id, name, profile_image FROM users WHERE id = $1', [3]);
    console.log('Updated therapist:', updated.rows[0]);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

setTherapistProfileImage();