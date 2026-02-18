import type { InferSelectModel } from "drizzle-orm";
import {
  date,
  doublePrecision,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const engineSchema = pgSchema("engine");

// ─── customers (accounts) ───────────────────────────────────────────
export const customers = engineSchema.table(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: varchar("account_id", { length: 256 }).notNull(),
    accountName: varchar("account_name", { length: 512 }),
    website: text("website"),
    domain: varchar("domain", { length: 256 }).notNull(),
    arr: doublePrecision("arr"),
    renewalDate: date("renewal_date"),
    segment: varchar("segment", { length: 128 }),
    status: varchar("status", { length: 64 }),
    licensedSeats: integer("licensed_seats"),
    extra: jsonb("extra"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastEnrichedAt: timestamp("last_enriched_at"),
    lastEnrichmentRunId: uuid("last_enrichment_run_id"),
  },
  (t) => ({
    customers_domain_idx: uniqueIndex("customers_domain_idx").on(t.domain),
  })
);

export type Customer = InferSelectModel<typeof customers>;

// ─── opportunities ──────────────────────────────────────────────────
export const opportunities = engineSchema.table("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: varchar("account_id", { length: 256 }).notNull(),
  opportunityId: varchar("opportunity_id", { length: 256 }),
  type: varchar("type", { length: 64 }),
  stage: varchar("stage", { length: 64 }),
  createdDate: date("created_date"),
  closeDate: date("close_date"),
  amount: doublePrecision("amount"),
  extra: jsonb("extra"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Opportunity = InferSelectModel<typeof opportunities>;

// ─── external_search_results ──────────────────────────────────────────
export const externalSearchResults = engineSchema.table(
  "external_search_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domain: varchar("domain", { length: 256 }).notNull(),
    query: text("query").notNull(),
    url: text("url").notNull(),
    title: text("title"),
    snippet: text("snippet"),
    searchTs: timestamp("search_ts").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  }
);

export type ExternalSearchResult = InferSelectModel<
  typeof externalSearchResults
>;

// ─── external_articles_raw ─────────────────────────────────────────────
export const externalArticlesRaw = engineSchema.table("external_articles_raw", {
  id: uuid("id").primaryKey().defaultRandom(),
  domain: varchar("domain", { length: 256 }).notNull(),
  url: text("url").notNull(),
  articleText: text("article_text").notNull(),
  publishedDate: date("published_date"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ExternalArticleRaw = InferSelectModel<typeof externalArticlesRaw>;

// ─── external_events ──────────────────────────────────────────────────
export const externalEvents = engineSchema.table("external_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  domain: varchar("domain", { length: 256 }).notNull(),
  eventType: varchar("event_type", { length: 128 }),
  eventTs: timestamp("event_ts"),
  source: varchar("source", { length: 256 }),
  sourceUrl: text("source_url"),
  payloadJson: jsonb("payload_json"),
  confidence: doublePrecision("confidence"),
  extra: jsonb("extra"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ExternalEvent = InferSelectModel<typeof externalEvents>;

// ─── telemetry ──────────────────────────────────────────────────────
export const telemetry = engineSchema.table(
  "telemetry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domain: varchar("domain", { length: 256 }).notNull(),
    month: date("month").notNull(),
    activeUsers30d: integer("active_users_30d"),
    licensedSeats: integer("licensed_seats"),
    featureAdoptionScore: doublePrecision("feature_adoption_score"),
    extra: jsonb("extra"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    telemetry_domain_month_idx: uniqueIndex("telemetry_domain_month_idx").on(
      t.domain,
      t.month
    ),
  })
);

export type Telemetry = InferSelectModel<typeof telemetry>;

// ─── atomic_signals (versioned) ──────────────────────────────────────
export const atomicSignals = engineSchema.table(
  "atomic_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domain: varchar("domain", { length: 256 }).notNull(),
    month: date("month").notNull(),
    signalType: varchar("signal_type", { length: 64 }).notNull(),
    signalValue: doublePrecision("signal_value"),
    signalScore: doublePrecision("signal_score"),
    signalTimestamp: timestamp("signal_timestamp"),
    signalVersion: varchar("signal_version", { length: 32 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    atomic_signals_domain_month_type_idx: uniqueIndex(
      "atomic_signals_domain_month_type_idx"
    ).on(t.domain, t.month, t.signalType),
  })
);

export type AtomicSignal = InferSelectModel<typeof atomicSignals>;

// ─── lift_stats (versioned) ──────────────────────────────────────────
export const liftStats = engineSchema.table("lift_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  signalType: varchar("signal_type", { length: 64 }).notNull(),
  expansionRate: doublePrecision("expansion_rate"),
  nonExpansionRate: doublePrecision("non_expansion_rate"),
  liftRatio: doublePrecision("lift_ratio"),
  sampleSize: integer("sample_size"),
  liftStatsVersion: varchar("lift_stats_version", { length: 32 }).notNull(),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
});

export type LiftStat = InferSelectModel<typeof liftStats>;

// ─── prompts (versioned, DB prompts for expansion) ───────────────────
export const prompts = engineSchema.table("prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull(),
  version: varchar("version", { length: 32 }).notNull(),
  systemPrompt: text("system_prompt").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Prompt = InferSelectModel<typeof prompts>;

// ─── runs ────────────────────────────────────────────────────────────
export const runs = engineSchema.table("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  evaluationMonth: date("evaluation_month").notNull(),
  promptId: uuid("prompt_id").references(() => prompts.id),
  promptVersion: varchar("prompt_version", { length: 32 }),
  signalVersion: varchar("signal_version", { length: 32 }).notNull(),
  liftStatsVersion: varchar("lift_stats_version", { length: 32 }).notNull(),
  engineVersion: varchar("engine_version", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(), // pending | running | completed | failed | partial | halted
  processedCount: integer("processed_count").default(0),
  totalCustomers: integer("total_customers"),
  lastProcessedIndex: integer("last_processed_index"), // 0-based index of last completed
  currentStep: varchar("current_step", { length: 64 }),
  currentDomain: varchar("current_domain", { length: 256 }),
  substepLabel: varchar("substep_label", { length: 512 }),
  config: jsonb("config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── run_log (verbose log for monitoring panel) ────────────────────────
export const runLog = engineSchema.table("run_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  seq: integer("seq").notNull(),
  ts: timestamp("ts").defaultNow().notNull(),
  level: varchar("level", { length: 16 }).notNull(), // info | warn | error
  domain: varchar("domain", { length: 256 }),
  step: varchar("step", { length: 64 }),
  message: text("message").notNull(),
  detail: jsonb("detail"),
});

export type RunLogEntry = InferSelectModel<typeof runLog>;

export type Run = InferSelectModel<typeof runs>;

// ─── account_context_snapshots ────────────────────────────────────────
export const accountContextSnapshots = engineSchema.table(
  "account_context_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    domain: varchar("domain", { length: 256 }).notNull(),
    evaluationMonth: date("evaluation_month").notNull(),
    dataQualityScore: doublePrecision("data_quality_score"),
    contextJson: jsonb("context_json").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  }
);

export type AccountContextSnapshot = InferSelectModel<
  typeof accountContextSnapshots
>;

// ─── llm_evaluations ──────────────────────────────────────────────────
export const llmEvaluations = engineSchema.table("llm_evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  domain: varchar("domain", { length: 256 }).notNull(),
  promptVersion: varchar("prompt_version", { length: 32 }),
  signalVersion: varchar("signal_version", { length: 32 }).notNull(),
  liftStatsVersion: varchar("lift_stats_version", { length: 32 }).notNull(),
  engineVersion: varchar("engine_version", { length: 32 }).notNull(),
  modelName: varchar("model_name", { length: 128 }).notNull(),
  expansionScore: integer("expansion_score"),
  riskScore: integer("risk_score"),
  recommendedMotion: varchar("recommended_motion", { length: 32 }),
  whyNow: text("why_now"),
  reasoning: text("reasoning"),
  evidenceUsed: jsonb("evidence_used"),
  rawResponse: jsonb("raw_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LlmEvaluation = InferSelectModel<typeof llmEvaluations>;
