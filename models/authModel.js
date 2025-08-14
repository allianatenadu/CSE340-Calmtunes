// models/authModel.js - Make sure this includes role in queries

const pool = require('../config/database');

const authModel = {
  // ✅ FIXED: Make sure to SELECT role field
  findUserByEmail: async (email) => {
    const query = 'SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  },

  // ✅ FIXED: Make sure to include role when creating user
  createUser: async (userData) => {
    const { name, email, password_hash } = userData;
    const query = `
      INSERT INTO users (name, email, password_hash, role, created_at)
      VALUES ($1, $2, $3, 'user', CURRENT_TIMESTAMP)
      RETURNING id, name, email, role, created_at
    `;
    const result = await pool.query(query, [name, email, password_hash]);
    return result.rows[0];
  },

  // Additional helper method to update user role
  updateUserRole: async (userId, role) => {
    const query = 'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role';
    const result = await pool.query(query, [role, userId]);
    return result.rows[0] || null;
  }
};

module.exports = authModel;