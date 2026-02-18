import Papa from "papaparse";
import { sanitizeDomain } from "./domain-hygiene";

/** Normalize header to snake_case for mapping */
function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/** Known column names per table (normalized). Extra columns go to `extra`. */
const CUSTOMER_KEYS = new Set([
  "account_id",
  "account_name",
  "website",
  "domain",
  "arr",
  "renewal_date",
  "segment",
  "status",
  "licensed_seats",
]);
const OPPORTUNITY_KEYS = new Set([
  "account_id",
  "opportunity_id",
  "type",
  "stage",
  "created_date",
  "close_date",
  "amount",
]);
const EXTERNAL_EVENT_KEYS = new Set([
  "domain",
  "event_type",
  "event_ts",
  "source",
  "source_url",
  "payload_json",
  "confidence",
]);
const TELEMETRY_KEYS = new Set([
  "domain",
  "month",
  "active_users_30d",
  "licensed_seats",
  "feature_adoption_score",
]);

function parseDate(v: string): string | null {
  if (v == null || v === "") {
    return null;
  }
  const s = String(v).trim();
  if (!s) {
    return null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function parseNum(v: string): number | null {
  if (v == null || v === "") {
    return null;
  }
  const n = Number.parseFloat(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
}

function parseTimestamp(v: string): string | null {
  if (v == null || v === "") {
    return null;
  }
  const s = String(v).trim();
  if (!s) {
    return null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export type CustomerRow = {
  accountId: string;
  accountName: string | null;
  website: string | null;
  domain: string;
  arr: number | null;
  renewalDate: string | null;
  segment: string | null;
  status: string | null;
  licensedSeats: number | null;
  extra: Record<string, unknown>;
};

export type OpportunityRow = {
  accountId: string;
  opportunityId: string | null;
  type: string | null;
  stage: string | null;
  createdDate: string | null;
  closeDate: string | null;
  amount: number | null;
  extra: Record<string, unknown>;
};

export type ExternalEventRow = {
  domain: string;
  eventType: string | null;
  eventTs: string | null;
  source: string | null;
  sourceUrl: string | null;
  payloadJson: Record<string, unknown> | null;
  confidence: number | null;
  extra: Record<string, unknown>;
};

export type TelemetryRow = {
  domain: string;
  month: string;
  activeUsers30d: number | null;
  licensedSeats: number | null;
  featureAdoptionScore: number | null;
  extra: Record<string, unknown>;
};

function pickExtra(
  row: Record<string, string>,
  known: Set<string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === "" || known.has(k)) {
      continue;
    }
    const num = parseNum(v);
    out[k] = num !== null ? num : v;
  }
  return out;
}

function rowToMap(row: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    map[normalizeHeader(key)] = value ?? "";
  }
  return map;
}

export function parseCustomersCsv(csvText: string): CustomerRow[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const rows: CustomerRow[] = [];
  for (const row of parsed.data) {
    const map = rowToMap(row);
    const domainRaw = map.domain || map.website || "";
    const domain =
      sanitizeDomain(domainRaw) || sanitizeDomain(map.website || "");
    if (!domain) {
      continue;
    }
    const seats = parseNum(map.licensed_seats ?? "");
    rows.push({
      accountId: (map.account_id ?? "").trim() || domain,
      accountName: (map.account_name ?? "").trim() || null,
      website: (map.website ?? "").trim() || null,
      domain,
      arr: parseNum(map.arr ?? ""),
      renewalDate: parseDate(map.renewal_date ?? ""),
      segment: (map.segment ?? "").trim() || null,
      status: (map.status ?? "").trim() || null,
      licensedSeats: seats != null ? Math.floor(Number(seats)) : null,
      extra: pickExtra(map, CUSTOMER_KEYS),
    });
  }
  return rows;
}

export function parseOpportunitiesCsv(csvText: string): OpportunityRow[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const rows: OpportunityRow[] = [];
  for (const row of parsed.data) {
    const map = rowToMap(row);
    const accountId = (map.account_id ?? "").trim();
    if (!accountId) {
      continue;
    }
    rows.push({
      accountId,
      opportunityId: (map.opportunity_id ?? "").trim() || null,
      type: (map.type ?? "").trim() || null,
      stage: (map.stage ?? "").trim() || null,
      createdDate: parseDate(map.created_date ?? ""),
      closeDate: parseDate(map.close_date ?? ""),
      amount: parseNum(map.amount ?? ""),
      extra: pickExtra(map, OPPORTUNITY_KEYS),
    });
  }
  return rows;
}

export function parseExternalEventsCsv(csvText: string): ExternalEventRow[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const rows: ExternalEventRow[] = [];
  for (const row of parsed.data) {
    const map = rowToMap(row);
    const domainRaw = (map.domain ?? "").trim();
    const domain = sanitizeDomain(domainRaw);
    if (!domain) {
      continue;
    }
    let payloadJson: Record<string, unknown> | null = null;
    const raw = (map.payload_json ?? "").trim();
    if (raw) {
      try {
        payloadJson = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        payloadJson = { raw };
      }
    }
    rows.push({
      domain,
      eventType: (map.event_type ?? "").trim() || null,
      eventTs: parseTimestamp(map.event_ts ?? ""),
      source: (map.source ?? "").trim() || null,
      sourceUrl: (map.source_url ?? "").trim() || null,
      payloadJson,
      confidence: parseNum(map.confidence ?? ""),
      extra: pickExtra(map, EXTERNAL_EVENT_KEYS),
    });
  }
  return rows;
}

export function parseTelemetryCsv(csvText: string): TelemetryRow[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const rows: TelemetryRow[] = [];
  for (const row of parsed.data) {
    const map = rowToMap(row);
    const domain = sanitizeDomain((map.domain ?? "").trim());
    const month = parseDate(map.month ?? "");
    if (!domain || !month) {
      continue;
    }
    const active = parseNum(map.active_users_30d ?? "");
    const seats = parseNum(map.licensed_seats ?? "");
    rows.push({
      domain,
      month,
      activeUsers30d: active != null ? Math.floor(Number(active)) : null,
      licensedSeats: seats != null ? Math.floor(Number(seats)) : null,
      featureAdoptionScore: parseNum(map.feature_adoption_score ?? ""),
      extra: pickExtra(map, TELEMETRY_KEYS),
    });
  }
  return rows;
}
