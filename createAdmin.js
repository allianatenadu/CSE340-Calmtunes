// createAdmin.js - Run this script once to create admin user
require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../CES40-Calmtunes/config/database');

async function createAdmin() {
  try {
    // Hash the password
    const passwordHash = await bcrypt.hash('admin257', 10);
    
    const query = `
      INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        updated_at = NOW()
      RETURNING id, name, email, role
    `;
    
    const result = await db.query(query, [
      'Admin User',
      'admin@calmtunes.com', 
      passwordHash,
      'admin'
    ]);
    
    console.log('✅ Admin user created/updated successfully:');
    console.log(result.rows[0]);
    console.log('\nLogin credentials:');
    console.log('Email: admin@calmtunes.com');
    console.log('Password: admin257');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

createAdmin();