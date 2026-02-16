/**
 * Seed script for generic chatbot.
 * No course/student data to seed; chat history is per session (cookie).
 *
 * Run migrations with: pnpm db:migrate
 */

import { config } from "dotenv";

config({ path: ".env.local", override: true });

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set, skipping seed.");
    process.exit(0);
  }
  console.log("Generic chatbot: no seed data. Use the app to start chatting.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
