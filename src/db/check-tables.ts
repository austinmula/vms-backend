import { Pool } from "pg";
import { config } from "../config";

async function checkTables() {
  const pool = new Pool({
    connectionString: config.database.url,
  });

  try {
    console.log("🔍 Checking tables in database...\n");

    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    if (result.rows.length === 0) {
      console.log("❌ No tables found in the public schema");
    } else {
      console.log(`✅ Found ${result.rows.length} tables:`);
      result.rows.forEach((row) => {
        console.log(`  - ${row.table_name}`);
      });
    }

    await pool.end();
  } catch (error) {
    console.error("❌ Error checking tables:", error);
    await pool.end();
    process.exit(1);
  }
}

checkTables();
