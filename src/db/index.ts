import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { config } from "../config";
import { log } from "../utils/logger";

const pool = new Pool({
  connectionString: config.database.url,
  ssl: config.database.url.includes("neon.tech")
    ? { rejectUnauthorized: false }
    : false,
});

export const db = drizzle(pool, { schema });

export async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    log.info("Database connection successful");
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}

export { pool };
export * from "./schema";
