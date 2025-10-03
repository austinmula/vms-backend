import { migrate } from "drizzle-orm/neon-http/migrator";
import { db } from "./index";
import { config } from "../config";

async function runMigrations() {
  console.log("🔄 Running database migrations...");

  try {
    await migrate(db, {
      migrationsFolder: "./src/db/migrations",
    });

    console.log("✅ Database migrations completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };
