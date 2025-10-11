const db = require('../config/database');

db.query("SELECT id, name, profile_image FROM users WHERE profile_image LIKE '%optimized_user_1_%'", (err, results) => {
  if (err) {
    console.error('Database error:', err);
  } else {
    console.log('Users with optimized_user_1 profile images:');
    results.rows.forEach(row => {
      console.log(`ID ${row.id}: ${row.name} - ${row.profile_image}`);
    });
  }
  db.end();
});