// models/authModel.js
const pool = require("../config/database");

const authModel = {
  findUserByEmail: async (email) => {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1 LIMIT 1",
      [email]
    );
    return result.rows[0];
  },

  findUserById: async (id) => {
    const result = await pool.query(
      "SELECT * FROM users WHERE id = $1 LIMIT 1",
      [id]
    );
    return result.rows[0];
  },

  createUser: async (userData) => {
    const { name, email, password_hash } = userData;
    const preferences = JSON.stringify({ favoriteGenres: [] });

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, preferences)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email`,
      [name, email, password_hash, preferences]
    );
    return result.rows[0];
  },

  updateUser: async (id, { name, email, profile_image }) => {
    await pool.query(
      `UPDATE users 
       SET name = $1, email = $2, profile_image = COALESCE($3, profile_image)
       WHERE id = $4`,
      [name, email, profile_image || null, id]
    );
  }
};

module.exports = authModel;
