// config/database.js
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config();

// Create a connection pool
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: {
    rejectUnauthorized: false, // required for Render PostgreSQL
  },
});

// Test database connection
(async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Database connected successfully");
    client.release();
  } catch (err) {
    console.error("❌ Database connection error:", err);
  }
})();

module.exports = pool;
