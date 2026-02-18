import { and, eq } from "drizzle-orm";
import { EXPANSION_SIGNAL_TYPES, RISK_SIGNAL_TYPES } from "./atomic-signals";
import { engineDb } from "./db/client";
import {
  accountContextSnapshots,
  atomicSignals,
  customers,
  externalEvents,
  liftStats,
  telemetry,
} from "./db/schema";

export type ContextSnapshotJson = {
  evaluation_context: {
    evaluation_month: string;
    data_quality_score: number;
  };
  account_profile: {
    account_name: string;
    domain: string;
    arr: number | null;
    renewal_date: string | null;
    segment: string | null;
  };
  atomic_signals: Array<{
    signal_type: string;
    signal_category: "EXPANSION" | "RISK" | "REENGAGE";
    signal_value: number | boolean;
    signal_score: number;
    signal_timestamp: string;
  }>;
  historical_signal_stats: Array<{
    signal_type: string;
    expansion_rate: number;
    non_expansion_rate: number;
    lift_ratio: number;
    sample_size: number;
  }>;
};

const SIGNAL_CATEGORY: Record<string, "EXPANSION" | "RISK" | "REENGAGE"> = {};
for (const t of EXPANSION_SIGNAL_TYPES) {
  SIGNAL_CATEGORY[t] = "EXPANSION";
}
for (const t of RISK_SIGNAL_TYPES) {
  SIGNAL_CATEGORY[t] = "RISK";
}

/** Compute data quality score: start 100, subtract for missing data. */
export async function computeDataQualityScore(
  domain: string,
  _evaluationMonth: string,
  customerLicensedSeats: number | null
): Promise<number> {
  let score = 100;

  const [telRows, eventRows, liftRows] = await Promise.all([
    engineDb.select().from(telemetry).where(eq(telemetry.domain, domain)),
    engineDb
      .select({ confidence: externalEvents.confidence })
      .from(externalEvents)
      .where(eq(externalEvents.domain, domain)),
    engineDb.select().from(liftStats).limit(1),
  ]);

  const telemetryMonths = telRows.length;
  const hasLicensedSeats =
    customerLicensedSeats != null ||
    telRows.some((t) => t.licensedSeats != null);
  if (!hasLicensedSeats) {
    score -= 20;
  }
  if (telemetryMonths < 2) {
    score -= 15;
  }
  if (liftRows.length === 0) {
    score -= 15;
  }

  const eventsInWindow = eventRows.filter((e) => e.confidence != null);
  const avgConfidence =
    eventsInWindow.length > 0
      ? eventsInWindow.reduce((s, e) => s + (e.confidence ?? 0), 0) /
        eventsInWindow.length
      : 1;
  if (avgConfidence < 0.7) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Build context snapshot JSON for one domain and persist to account_context_snapshots. */
export async function buildAndStoreContextSnapshot(
  runId: string,
  domain: string,
  evaluationMonth: string
): Promise<{ dataQualityScore: number; contextJson: ContextSnapshotJson }> {
  const [customer, signals, stats] = await Promise.all([
    engineDb
      .select()
      .from(customers)
      .where(eq(customers.domain, domain))
      .limit(1)
      .then((rows) => rows[0]),
    engineDb
      .select()
      .from(atomicSignals)
      .where(
        and(
          eq(atomicSignals.domain, domain),
          eq(atomicSignals.month, evaluationMonth)
        )
      ),
    engineDb.select().from(liftStats),
  ]);

  const dataQuality = await computeDataQualityScore(
    domain,
    evaluationMonth,
    customer?.licensedSeats ?? null
  );

  const atomicSignalsList = signals.map((s) => ({
    signal_type: s.signalType,
    signal_category: SIGNAL_CATEGORY[s.signalType] ?? "REENGAGE",
    signal_value: typeof s.signalValue === "number" ? s.signalValue : false,
    signal_score: s.signalScore ?? 0,
    signal_timestamp: (s.signalTimestamp ?? s.month).toString().slice(0, 10),
  }));

  const historicalSignalStats = stats.map((h) => ({
    signal_type: h.signalType,
    expansion_rate: h.expansionRate ?? 0,
    non_expansion_rate: h.nonExpansionRate ?? 0,
    lift_ratio: h.liftRatio ?? 0,
    sample_size: h.sampleSize ?? 0,
  }));

  const contextJson: ContextSnapshotJson = {
    evaluation_context: {
      evaluation_month: evaluationMonth,
      data_quality_score: dataQuality,
    },
    account_profile: {
      account_name: customer?.accountName ?? "",
      domain,
      arr: customer?.arr ?? null,
      renewal_date: customer?.renewalDate ?? null,
      segment: customer?.segment ?? null,
    },
    atomic_signals: atomicSignalsList,
    historical_signal_stats: historicalSignalStats,
  };

  await engineDb.insert(accountContextSnapshots).values({
    runId,
    domain,
    evaluationMonth,
    dataQualityScore: dataQuality,
    contextJson: contextJson as unknown as Record<string, unknown>,
  });

  return { dataQualityScore: dataQuality, contextJson };
}
