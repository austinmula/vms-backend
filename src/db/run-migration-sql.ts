import { Pool } from "pg";
import { config } from "../config";
import * as fs from "fs";
import * as path from "path";

async function runMigrationSQL() {
  const pool = new Pool({
    connectionString: config.database.url,
  });

  try {
    console.log("🔄 Running migration SQL directly...\n");

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, "migrations", "0000_puzzling_hex.sql");
    const migrationSQL = fs.readFileSync(migrationPath, "utf-8");

    // Execute the entire migration SQL
    await pool.query(migrationSQL);

    console.log("✅ Migration SQL executed successfully!");

    await pool.end();
  } catch (error) {
    console.error("❌ Error executing migration SQL:", error);
    await pool.end();
    process.exit(1);
  }
}

runMigrationSQL();
