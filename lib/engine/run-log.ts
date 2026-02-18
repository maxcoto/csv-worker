import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { engineDb } from "./db/client";
import { runLog } from "./db/schema";

export type LogLevel = "info" | "warn" | "error";

export type RunLogDetail = Record<string, unknown>;

/**
 * Append a log entry for a run. Used by external events pipeline and rest of run.
 * Seq is computed from DB max(seq)+1 so it works across restarts.
 */
export async function appendRunLog(
  runId: string,
  level: LogLevel,
  message: string,
  options?: { domain?: string; step?: string; detail?: RunLogDetail }
): Promise<void> {
  const maxSeq = await getMaxSeq(runId);
  const seq = maxSeq + 1;
  await engineDb.insert(runLog).values({
    runId,
    seq,
    level,
    domain: options?.domain ?? null,
    step: options?.step ?? null,
    message,
    detail: (options?.detail ?? null) as Record<string, unknown> | null,
  });
}

/**
 * Get max seq for a run (for polling "since").
 */
export async function getMaxSeq(runId: string): Promise<number> {
  const [row] = await engineDb
    .select({ maxSeq: sql<number>`COALESCE(MAX(${runLog.seq}), 0)` })
    .from(runLog)
    .where(eq(runLog.runId, runId));
  return Number(row?.maxSeq ?? 0);
}

/**
 * No-op for compatibility; seq is now computed from DB.
 */
export function resetRunLogSeq(_runId: string): void {
  /* intentional no-op */
}

export type RunLogEntryDto = {
  seq: number;
  ts: string;
  level: string;
  domain: string | null;
  step: string | null;
  message: string;
  detail: Record<string, unknown> | null;
};

export type GetRunLogOptions =
  | { since: number; limit: number }
  | { tail: number };

/**
 * Get log entries for a run. Use since+limit for polling new entries, or tail for last N.
 */
export async function getRunLogEntries(
  runId: string,
  options: GetRunLogOptions
): Promise<{ entries: RunLogEntryDto[]; hasMore: boolean }> {
  if ("tail" in options) {
    const rows = await engineDb
      .select({
        seq: runLog.seq,
        ts: runLog.ts,
        level: runLog.level,
        domain: runLog.domain,
        step: runLog.step,
        message: runLog.message,
        detail: runLog.detail,
      })
      .from(runLog)
      .where(eq(runLog.runId, runId))
      .orderBy(desc(runLog.seq))
      .limit(options.tail);
    const entries = rows.reverse().map((r) => ({
      seq: r.seq,
      ts: r.ts.toISOString(),
      level: r.level,
      domain: r.domain,
      step: r.step,
      message: r.message,
      detail: r.detail as Record<string, unknown> | null,
    }));
    return { entries, hasMore: false };
  }

  const rows = await engineDb
    .select({
      seq: runLog.seq,
      ts: runLog.ts,
      level: runLog.level,
      domain: runLog.domain,
      step: runLog.step,
      message: runLog.message,
      detail: runLog.detail,
    })
    .from(runLog)
    .where(and(eq(runLog.runId, runId), gt(runLog.seq, options.since)))
    .orderBy(asc(runLog.seq))
    .limit(options.limit + 1);
  const hasMore = rows.length > options.limit;
  const entries = (hasMore ? rows.slice(0, options.limit) : rows).map((r) => ({
    seq: r.seq,
    ts: r.ts.toISOString(),
    level: r.level,
    domain: r.domain,
    step: r.step,
    message: r.message,
    detail: r.detail as Record<string, unknown> | null,
  }));
  return { entries, hasMore };
}
