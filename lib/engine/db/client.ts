import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// Drizzle schema option requires the full schema object; namespace import is intentional.
// biome-ignore lint/performance/noNamespaceImport: required by drizzle({ schema })
import * as engineSchema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set");
}

const client = postgres(connectionString, { max: 10 });
export const engineDb = drizzle(client, { schema: engineSchema });
