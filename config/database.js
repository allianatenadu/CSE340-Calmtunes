// config/database.js - COMPLETE FIXED VERSION
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config();

// Create a connection pool with retry logic
const createPool = () => {
  return new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    maxUses: 7500,
  });
};

let pool = createPool();

// Test database connection with retry logic
const testConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log("✅ Database connected successfully");
      client.release();
      return true;
    } catch (err) {
      console.error(
        `❌ Database connection error (attempt ${i + 1}/${retries}):`,
        err.message
      );

      if (i === retries - 1) {
        console.error("❌ All database connection attempts failed");
        return false;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
};

testConnection();

// Handle pool errors
pool.on("error", (err, client) => {
  console.error("❌ Unexpected database pool error:", err);
  console.log("🔄 Attempting to recreate database pool...");
  pool = createPool();
  // testConnection(); // Commented out to prevent hanging on module load
});

module.exports = pool;

module.exports.createFallbackConnection = async () => {
  try {
    const fallbackPool = createPool();
    const client = await fallbackPool.connect();
    console.log("✅ Fallback database connection established");
    return { client, pool: fallbackPool };
  } catch (error) {
    console.error("❌ Fallback database connection failed:", error);
    throw error;
  }
};

// FIXED: Function to add admin support to EXISTING conversations table
module.exports.createUnifiedChatTables = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("🚀 Adding admin chat support to existing tables...");

    // Check what columns exist in conversations table
    const columnsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'conversations'
    `);

    const existingColumns = columnsCheck.rows.map((row) => row.column_name);
    console.log("📋 Existing conversation columns:", existingColumns);

    // Add missing columns to EXISTING conversations table
    if (!existingColumns.includes("conversation_type")) {
      await client.query(`
        ALTER TABLE conversations 
        ADD COLUMN IF NOT EXISTS conversation_type VARCHAR(20) DEFAULT 'regular'
      `);
      console.log("✅ Added conversation_type column");
    }

    if (!existingColumns.includes("admin_id")) {
      await client.query(`
        ALTER TABLE conversations 
        ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES users(id)
      `);
      console.log("✅ Added admin_id column");
    }

    if (!existingColumns.includes("status")) {
      await client.query(`
        ALTER TABLE conversations 
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
      `);
      console.log("✅ Added status column");
    }

    if (!existingColumns.includes("closed_at")) {
      await client.query(`
        ALTER TABLE conversations 
        ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP
      `);
      console.log("✅ Added closed_at column");
    }

    if (!existingColumns.includes("closed_by")) {
      await client.query(`
        ALTER TABLE conversations 
        ADD COLUMN IF NOT EXISTS closed_by INTEGER REFERENCES users(id)
      `);
      console.log("✅ Added closed_by column");
    }

    if (!existingColumns.includes("closure_reason")) {
      await client.query(`
        ALTER TABLE conversations 
        ADD COLUMN IF NOT EXISTS closure_reason TEXT
      `);
      console.log("✅ Added closure_reason column");
    }

    // Create indexes on EXISTING columns (patient_id, therapist_id)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_patient_id 
      ON conversations(patient_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_therapist_id 
      ON conversations(therapist_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_admin_id 
      ON conversations(admin_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_type 
      ON conversations(conversation_type)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id 
      ON messages(conversation_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_sender_id 
      ON messages(sender_id)
    `);

    console.log("✅ Indexes created successfully");

    // Update existing rows
    await client.query(`
      UPDATE conversations 
      SET conversation_type = 'regular', status = 'active'
      WHERE conversation_type IS NULL OR status IS NULL
    `);

    console.log("✅ Updated existing conversation rows");

    // Create patient_concerns table
    await client.query(`
      CREATE TABLE IF NOT EXISTS patient_concerns (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES users(id),
        admin_id INTEGER NOT NULL REFERENCES users(id),
        concern_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        resolved_by INTEGER REFERENCES users(id),
        resolution_notes TEXT
      )
    `);

    console.log("✅ patient_concerns table ready");

    // Create therapist_contracts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS therapist_contracts (
        id SERIAL PRIMARY KEY,
        therapist_id INTEGER NOT NULL REFERENCES users(id),
        admin_id INTEGER NOT NULL REFERENCES users(id),
        contract_type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        requires_acknowledgment BOOLEAN DEFAULT false,
        acknowledgment_deadline TIMESTAMP,
        acknowledged_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'sent',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ therapist_contracts table ready");

    await client.query("COMMIT");
    console.log("✅ All admin chat support added successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error adding admin chat support:", error);
    throw error;
  } finally {
    client.release();
  }
};

// Keep admin chat tables function (for backwards compatibility)
module.exports.createAdminChatTables = async () => {
  console.log("ℹ️  Admin chat now uses unified conversations table");
  console.log("ℹ️  Running createUnifiedChatTables instead...");
  return module.exports.createUnifiedChatTables();
};

// Database testing functionality
module.exports.testDatabase = async () => {
  try {
    console.log("Testing database connection...");

    const result = await pool.query("SELECT 1 as test");
    console.log("✅ Database connection successful");

    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log("\n📋 Available tables:");
    if (tablesResult.rows.length === 0) {
      console.log("❌ No tables found in database");
    } else {
      tablesResult.rows.forEach((row) => {
        console.log(`- ${row.table_name}`);
      });
    }

    const requiredTables = [
      "users",
      "therapist_applications",
      "conversations",
      "messages",
    ];

    console.log("\n🔍 Checking required tables:");
    for (const table of requiredTables) {
      const exists = tablesResult.rows.some((row) => row.table_name === table);
      console.log(`${exists ? "✅" : "❌"} ${table}`);
    }

    return true;
  } catch (error) {
    console.error("❌ Database error:", error.message);
    throw error;
  }
};
