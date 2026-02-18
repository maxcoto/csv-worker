/**
 * Layer 5: Deduplicate by (domain, event_type, event_ts ± 3 days) and insert into external_events.
 */

import { and, eq, gte, lte } from "drizzle-orm";
import { engineDb } from "@/lib/engine/db/client";
import { externalEvents } from "@/lib/engine/db/schema";
import type { ExternalEventRow } from "./llm-extract";

const TOLERANCE_DAYS = 3;

function parseDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Check if an event with same domain, event_type, and event_ts within ±3 days already exists.
 */
async function isDuplicate(
  domain: string,
  eventType: string,
  eventTs: string
): Promise<boolean> {
  const d = parseDate(eventTs);
  if (!d) {
    return false;
  }
  const low = new Date(d);
  low.setDate(low.getDate() - TOLERANCE_DAYS);
  const high = new Date(d);
  high.setDate(high.getDate() + TOLERANCE_DAYS);
  const lowStr = low.toISOString().slice(0, 10);
  const highStr = high.toISOString().slice(0, 10);

  const existing = await engineDb
    .select({ id: externalEvents.id })
    .from(externalEvents)
    .where(
      and(
        eq(externalEvents.domain, domain),
        eq(externalEvents.eventType, eventType),
        gte(externalEvents.eventTs, new Date(lowStr)),
        lte(externalEvents.eventTs, new Date(highStr))
      )
    )
    .limit(1);
  return existing.length > 0;
}

/**
 * Dedupe and insert rows into external_events. Returns count inserted.
 */
export async function dedupeAndStore(
  rows: ExternalEventRow[]
): Promise<number> {
  let inserted = 0;
  for (const row of rows) {
    const dup = await isDuplicate(row.domain, row.eventType, row.eventTs);
    if (dup) {
      continue;
    }
    const eventTsDate = parseDate(row.eventTs);
    await engineDb.insert(externalEvents).values({
      domain: row.domain,
      eventType: row.eventType,
      eventTs: eventTsDate ? new Date(eventTsDate) : null,
      source: row.source,
      sourceUrl: row.sourceUrl,
      payloadJson: row.payloadJson as Record<string, unknown>,
      confidence: row.confidence,
    });
    inserted += 1;
  }
  return inserted;
}
