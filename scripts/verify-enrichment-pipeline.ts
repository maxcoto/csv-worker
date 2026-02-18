/**
 * Verifies the external events enrichment pipeline:
 * - Query builder returns 4 exec_hire, 3 exec_departure, 4 layoff, 3 headcount_growth.
 * - Pipeline order: buildSearchQueries -> runSearchAndStore -> fetchAndStoreArticles -> extractEventsFromArticle -> dedupeAndStore.
 *
 * Usage: pnpm exec tsx scripts/verify-enrichment-pipeline.ts
 */

import { buildSearchQueries } from "../lib/engine/external-events/query-builder";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

// 1) Query counts
const queries = buildSearchQueries("example.com", "Example");
assert(queries.length === 14, `Expected 14 queries, got ${queries.length}`);

const byCategory = new Map<string, number>();
for (const q of queries) {
  byCategory.set(q.category, (byCategory.get(q.category) ?? 0) + 1);
}
assert(
  (byCategory.get("exec_hire") ?? 0) === 4,
  `Expected 4 exec_hire, got ${byCategory.get("exec_hire") ?? 0}`
);
assert(
  (byCategory.get("exec_departure") ?? 0) === 3,
  `Expected 3 exec_departure, got ${byCategory.get("exec_departure") ?? 0}`
);
assert(
  (byCategory.get("layoff") ?? 0) === 4,
  `Expected 4 layoff, got ${byCategory.get("layoff") ?? 0}`
);
assert(
  (byCategory.get("headcount_growth") ?? 0) === 3,
  `Expected 3 headcount_growth, got ${byCategory.get("headcount_growth") ?? 0}`
);

// 2) Pipeline order in run-enrichment.ts (call sites, not imports)
const runEnrichmentPath = join(
  process.cwd(),
  "lib",
  "engine",
  "external-events",
  "run-enrichment.ts"
);
const runEnrichmentSource = readFileSync(runEnrichmentPath, "utf-8");
const callSitePatterns = [
  "buildSearchQueries(domain",
  "runSearchAndStore(",
  "fetchAndStoreArticles(",
  "extractEventsFromArticle(",
  "dedupeAndStore(eventRows",
];
let lastIndex = -1;
for (const pattern of callSitePatterns) {
  const idx = runEnrichmentSource.indexOf(pattern);
  assert(idx > lastIndex, `Pipeline order: expected call ${pattern} after previous step`);
  lastIndex = idx;
}

console.log("OK: Query counts (4 exec_hire, 3 exec_departure, 4 layoff, 3 headcount_growth) verified.");
console.log("OK: Pipeline order (Layers 1–5) verified in run-enrichment.ts.");
