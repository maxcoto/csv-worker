/**
 * Run Drizzle migrations against DATABASE_URL.
 * Migrations folder is resolved relative to this file so it works in any cwd (e.g. production build).
 *
 * Production: set DATABASE_URL in your build/release environment so the build step
 * "tsx lib/db/migrate && next build" runs migrations. If your platform only injects env at runtime,
 * run migrations in a release step: DATABASE_URL=<prod-url> pnpm db:migrate
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Load env: .env.local (local) and .env (e.g. production). Existing process.env wins.
config({ path: ".env.local", override: false });
config({ path: ".env", override: false });

const runMigrate = async () => {
  if (!process.env.DATABASE_URL) {
    console.log("⏭️  DATABASE_URL not defined, skipping migrations");
    process.exit(0);
  }

  const connection = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(connection);

  // Suppress NOTICE (e.g. "schema already exists, skipping") for cleaner output
  await connection`SET client_min_messages TO WARNING`;

  console.log("⏳ Running migrations...");

  // Resolve migrations folder relative to this script so it works in any cwd (e.g. production build)
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.join(scriptDir, "migrations");

  const start = Date.now();
  await migrate(db, { migrationsFolder });
  const end = Date.now();

  console.log("✅ Migrations completed in", end - start, "ms");
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error("❌ Migration failed");
  console.error(err);
  process.exit(1);
});
