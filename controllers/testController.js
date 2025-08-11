// controllers/testController.js
const pool = require('../config/database');

exports.checkDatabase = async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.send(`✅ Database connected! Server time: ${result.rows[0].now}`);
  } catch (err) {
    console.error('Database test error:', err.message);
    res.status(500).send('❌ Database connection failed.');
  }
};
