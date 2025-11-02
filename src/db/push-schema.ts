import { sql } from "./index";
import * as fs from "fs";
import * as path from "path";

async function pushSchema() {
  try {
    console.log("🔄 Pushing schema to database...");

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, "migrations", "0000_puzzling_hex.sql");
    const migrationSQL = fs.readFileSync(migrationPath, "utf-8");

    // Execute the migration SQL
    await sql(migrationSQL);

    console.log("✅ Schema pushed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to push schema:", error);
    process.exit(1);
  }
}

pushSchema();
