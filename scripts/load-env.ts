/**
 * Load .env.local and .env before any other imports that need process.env.
 * Import this first in standalone scripts so DATABASE_URL etc. are set before
 * modules like lib/engine/db/client are loaded.
 */
import { config } from "dotenv";

config({ path: ".env.local", override: false });
config({ path: ".env", override: false });
