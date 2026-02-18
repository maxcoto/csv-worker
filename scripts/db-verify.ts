import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", override: false });
config({ path: ".env", override: false });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });
  const tables = await sql`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema IN ('public', 'engine')
    ORDER BY table_schema, table_name
  `;
  console.log("Tables in DB:");
  for (const r of tables) {
    console.log("  ", `${r.table_schema}.${r.table_name}`);
  }
  await sql.end({ timeout: 0 });
  console.log("Verify done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
