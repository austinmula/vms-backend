import { pool } from "./index";
import * as fs from "fs";
import * as path from "path";

async function pushSchema() {
  const client = await pool.connect();
  try {
    console.log("Pushing schema to database...");

    const migrationPath = path.join(__dirname, "migrations", "0000_puzzling_hex.sql");
    const migrationSQL = fs.readFileSync(migrationPath, "utf-8");

    await client.query(migrationSQL);

    console.log("Schema pushed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Failed to push schema:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

pushSchema();
