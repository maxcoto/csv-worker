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

function normalizeSummary(payload: Record<string, unknown> | null): string {
  const s =
    payload && typeof payload.summary === "string" ? payload.summary : "";
  return s.toLowerCase().trim();
}

/** Simple similarity: exact match or one normalized summary contains the other. */
function isSimilarSummary(
  newSummary: string,
  existingSummary: string
): boolean {
  if (newSummary === existingSummary) {
    return true;
  }
  if (newSummary.length >= 20 && existingSummary.length >= 20) {
    return (
      newSummary.includes(existingSummary) ||
      existingSummary.includes(newSummary)
    );
  }
  return false;
}

/**
 * Find existing events in (domain, event_type, event_ts ± 3 days). Returns skip reason or null if insert allowed.
 */
async function getSkipReason(
  domain: string,
  eventType: string,
  eventTs: string,
  payloadJson: Record<string, unknown>
): Promise<"duplicate" | "similar_payload" | null> {
  const d = parseDate(eventTs);
  if (!d) {
    return null;
  }
  const low = new Date(d);
  low.setDate(low.getDate() - TOLERANCE_DAYS);
  const high = new Date(d);
  high.setDate(high.getDate() + TOLERANCE_DAYS);
  const lowStr = low.toISOString().slice(0, 10);
  const highStr = high.toISOString().slice(0, 10);

  const existing = await engineDb
    .select({ payloadJson: externalEvents.payloadJson })
    .from(externalEvents)
    .where(
      and(
        eq(externalEvents.domain, domain),
        eq(externalEvents.eventType, eventType),
        gte(externalEvents.eventTs, new Date(lowStr)),
        lte(externalEvents.eventTs, new Date(highStr))
      )
    );
  if (existing.length === 0) {
    return null;
  }
  const newSummary = normalizeSummary(payloadJson);
  for (const row of existing) {
    const existingPayload = row.payloadJson as Record<string, unknown> | null;
    const existingSummary = normalizeSummary(existingPayload);
    if (isSimilarSummary(newSummary, existingSummary)) {
      return "similar_payload";
    }
  }
  return "duplicate";
}

export type DedupeAndStoreOptions = {
  onSkip?: (
    domain: string,
    eventType: string,
    eventTs: string,
    reason: string
  ) => void;
  onInsert?: (domain: string, eventType: string, eventTs: string) => void;
};

/**
 * Dedupe and insert rows into external_events. Returns count inserted.
 */
export async function dedupeAndStore(
  rows: ExternalEventRow[],
  options?: DedupeAndStoreOptions
): Promise<number> {
  let inserted = 0;
  for (const row of rows) {
    const reason = await getSkipReason(
      row.domain,
      row.eventType,
      row.eventTs,
      row.payloadJson as Record<string, unknown>
    );
    if (reason !== null) {
      options?.onSkip?.(row.domain, row.eventType, row.eventTs, reason);
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
    options?.onInsert?.(row.domain, row.eventType, row.eventTs);
  }
  return inserted;
}
