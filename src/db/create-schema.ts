import { Pool } from "pg";
import { config } from "../config";

async function createSchema() {
  const pool = new Pool({
    connectionString: config.database.url,
  });

  try {
    console.log("🔄 Creating public schema...");
    await pool.query("CREATE SCHEMA IF NOT EXISTS public;");
    await pool.query("GRANT ALL ON SCHEMA public TO public;");
    console.log("✅ Public schema created and permissions granted");
    await pool.end();
  } catch (error) {
    console.error("❌ Error creating schema:", error);
    await pool.end();
    process.exit(1);
  }
}

createSchema();
