/**
 * Drop all app and engine tables/schemas and re-run migrations from scratch.
 * Uses DATABASE_URL from .env.local / .env (same as db:migrate).
 *
 * Usage: pnpm db:reset  (or npx tsx scripts/db-reset.ts)
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", override: false });
config({ path: ".env", override: false });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set. Set it in .env or .env.local");
    process.exit(1);
  }

  const connection = postgres(url, { max: 1 });
  await connection`SET client_min_messages TO WARNING`;

  console.log("Dropping all tables and schemas...");
  await connection`DROP SCHEMA IF EXISTS engine CASCADE`;
  await connection`DROP TABLE IF EXISTS "ChatMessage"`;
  await connection`DROP SCHEMA IF EXISTS drizzle CASCADE`;
  await connection.end({ timeout: 0 });

  console.log("Running migrations from scratch...");
  const migratePath = path.join(process.cwd(), "lib", "db", "migrate.ts");
  execSync(`npx tsx ${migratePath}`, {
    stdio: "inherit",
    env: process.env,
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
