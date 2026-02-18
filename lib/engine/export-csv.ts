import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { engineDb } from "./db/client";
import {
  accountContextSnapshots,
  customers,
  externalEvents,
  llmEvaluations,
  runs,
} from "./db/schema";

const HIGH_ARR_THRESHOLD = 50_000;
const EXPANSION_SCORE_THRESHOLD = 70;
/** Executive-departure event types (Expansion Evaluation taxonomy) for linkedin_review_recommended. */
const EXEC_EVENT_TYPES = ["EXEC_HIRE_LD", "EXEC_DEPARTURE_LD"] as const;

export type ExportRow = {
  account_name: string;
  domain: string;
  arr: number | null;
  renewal_date: string | null;
  expansion_score: number | null;
  risk_score: number | null;
  impact_score: number;
  recommended_motion: string | null;
  why_now: string | null;
  reasoning: string | null;
  evidence_used: string;
  data_quality_score: number | null;
  linkedin_review_recommended: boolean;
};

/** normalized_arr_weight = log(arr + 1); impact_score = expansion_score * normalized_arr_weight */
function impactScore(expansionScore: number, arr: number | null): number {
  const arrVal = arr ?? 0;
  const weight = Math.log(arrVal + 1);
  return expansionScore * weight;
}

/** Get ranked results for a run and build export rows. */
export async function getExportRows(runId: string): Promise<ExportRow[]> {
  const [run] = await engineDb
    .select({ evaluationMonth: runs.evaluationMonth })
    .from(runs)
    .where(eq(runs.id, runId));
  const evaluationMonth = run?.evaluationMonth;
  const windowEnd = evaluationMonth
    ? new Date(`${String(evaluationMonth).slice(0, 7)}-01`)
    : new Date();
  const windowStart = new Date(windowEnd);
  windowStart.setFullYear(windowStart.getFullYear() - 1);

  const evals = await engineDb
    .select()
    .from(llmEvaluations)
    .where(eq(llmEvaluations.runId, runId));
  const domains = evals.map((e) => e.domain);
  if (domains.length === 0) {
    return [];
  }

  const snapshots = await engineDb
    .select()
    .from(accountContextSnapshots)
    .where(eq(accountContextSnapshots.runId, runId));
  const snapshotByDomain = new Map(snapshots.map((s) => [s.domain, s]));
  const allCustomers = await engineDb
    .select()
    .from(customers)
    .where(inArray(customers.domain, domains));
  const customerByDomain = new Map(allCustomers.map((c) => [c.domain, c]));

  const execEventsByDomain = new Map<string, number>();
  if (domains.length > 0 && evaluationMonth) {
    const execEvents = await engineDb
      .select({ domain: externalEvents.domain })
      .from(externalEvents)
      .where(
        and(
          inArray(externalEvents.domain, domains),
          inArray(externalEvents.eventType, [...EXEC_EVENT_TYPES]),
          gte(externalEvents.eventTs, windowStart),
          lte(externalEvents.eventTs, windowEnd)
        )
      );
    for (const row of execEvents) {
      execEventsByDomain.set(
        row.domain,
        (execEventsByDomain.get(row.domain) ?? 0) + 1
      );
    }
  }

  const motionOrder: Record<string, number> = {
    EXPAND: 0,
    MONITOR: 1,
    SAVE: 2,
  };
  const rows: ExportRow[] = evals.map((e) => {
    const cust = customerByDomain.get(e.domain);
    const snap = snapshotByDomain.get(e.domain);
    const exp = e.expansionScore ?? 0;
    const arr = cust?.arr ?? null;
    const hasExecEvents = (execEventsByDomain.get(e.domain) ?? 0) > 0;
    const highArr = (arr ?? 0) >= HIGH_ARR_THRESHOLD;
    const highExpansion = (e.expansionScore ?? 0) >= EXPANSION_SCORE_THRESHOLD;
    const linkedin_review_recommended =
      !hasExecEvents && highArr && highExpansion;
    return {
      account_name: cust?.accountName ?? "",
      domain: e.domain,
      arr: arr ?? null,
      renewal_date: cust?.renewalDate ?? null,
      expansion_score: e.expansionScore ?? null,
      risk_score: e.riskScore ?? null,
      impact_score: impactScore(exp, arr),
      recommended_motion: e.recommendedMotion ?? null,
      why_now: e.whyNow ?? null,
      reasoning: e.reasoning ?? null,
      evidence_used: JSON.stringify(e.evidenceUsed ?? []),
      data_quality_score: snap?.dataQualityScore ?? null,
      linkedin_review_recommended,
    };
  });

  rows.sort((a, b) => {
    const motionA = motionOrder[a.recommended_motion ?? ""] ?? 1;
    const motionB = motionOrder[b.recommended_motion ?? ""] ?? 1;
    if (motionA !== motionB) {
      return motionA - motionB;
    }
    if (b.impact_score !== a.impact_score) {
      return b.impact_score - a.impact_score;
    }
    return (b.expansion_score ?? 0) - (a.expansion_score ?? 0);
  });

  return rows;
}

/** Generate CSV string for expansion_signal_report_<evaluation_month>.csv */
export function toCsv(rows: ExportRow[]): string {
  const header = [
    "account_name",
    "domain",
    "arr",
    "renewal_date",
    "expansion_score",
    "risk_score",
    "impact_score",
    "recommended_motion",
    "why_now",
    "reasoning",
    "evidence_used",
    "data_quality_score",
    "linkedin_review_recommended",
  ];
  const csvEscape = (v: string | number | null | undefined): string => {
    if (v == null) {
      return "";
    }
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.account_name),
        csvEscape(r.domain),
        csvEscape(r.arr),
        csvEscape(r.renewal_date),
        csvEscape(r.expansion_score),
        csvEscape(r.risk_score),
        csvEscape(r.impact_score),
        csvEscape(r.recommended_motion),
        csvEscape(r.why_now),
        csvEscape(r.reasoning),
        csvEscape(r.evidence_used),
        csvEscape(r.data_quality_score),
        csvEscape(String(r.linkedin_review_recommended)),
      ].join(",")
    );
  }
  return lines.join("\n");
}
