/**
 * Seed script for Expansion Signal Engine.
 * Run migrations with: pnpm db:migrate
 */

import { config } from "dotenv";

config({ path: ".env.local", override: true });

function seed() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set, skipping seed.");
    process.exit(0);
  }
  console.log("No seed data. Use the app to ingest CSVs and run evaluation.");
  process.exit(0);
}

try {
  seed();
} catch (err) {
  console.error(err);
  process.exit(1);
}
