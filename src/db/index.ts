import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { config } from "../config";

// Create the connection
const sql = neon(config.database.url);

// Create the database instance with schema
export const db = drizzle(sql, { schema });

// Connection test function
export async function testConnection() {
  try {
    const result = await sql`SELECT 1 as test`;
    console.log("✅ Database connection successful");
    return result;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }
}

export { sql };
export * from "./schema";
