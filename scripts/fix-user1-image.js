const db = require('../config/database');

console.log('🔧 Fixing user 1 profile image extension...');

db.query(
  "UPDATE users SET profile_image = '/uploads/profiles/optimized_user_1_1757438739635.jpg' WHERE id = 1 AND profile_image = '/uploads/profiles/optimized_user_1_1757438739635.jpeg'",
  (err, results) => {
    if (err) {
      console.error('❌ Database error:', err);
    } else {
      console.log(`✅ Updated ${results.rowCount} user profile image from .jpeg to .jpg`);
    }
    db.end();
  }
);