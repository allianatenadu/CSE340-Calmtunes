require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function createUserContactsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS user_contacts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      type VARCHAR(50) DEFAULT 'personal',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, phone)
    );
  `;

  try {
    const result = await pool.query(query);
    console.log("✅ User contacts table created successfully");
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating table:", err);
    await pool.end();
    process.exit(1);
  }
}

createUserContactsTable();
