import { and, desc, eq, lt } from "drizzle-orm";
import { getPromptContent } from "@/lib/prompts/load-prompts";
import { computeAtomicSignals, SIGNAL_VERSION } from "./atomic-signals";
import { buildAndStoreContextSnapshot } from "./context-snapshot";
import { engineDb } from "./db/client";
import {
  customers,
  llmEvaluations,
  prompts,
  runs,
  telemetry,
} from "./db/schema";
import { runExternalEventsEnrichment } from "./external-events/run-enrichment";
import { computeLiftStats, LIFT_STATS_VERSION } from "./lift-stats";
import { ENGINE_VERSION, evaluateWithLlm } from "./llm-evaluation";
import { appendRunLog } from "./run-log";

export type RunConfig = {
  eventPromptId: string | null;
  promptId: string | null;
  promptVersion: string;
  startRow: number; // 1-based
};

/** Latest complete telemetry month (month < current month). */
export async function resolveEvaluationMonth(): Promise<string> {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
  const currentMonthStart = `${currentMonth}-01`;
  const [row] = await engineDb
    .select({ month: telemetry.month })
    .from(telemetry)
    .where(lt(telemetry.month, currentMonthStart))
    .orderBy(desc(telemetry.month))
    .limit(1);
  if (!row?.month) {
    const fallback = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return fallback.toISOString().slice(0, 10);
  }
  return String(row.month).slice(0, 10);
}

export type RunConfigSnapshot = {
  startRow?: number;
  eventPromptId?: string | null;
  promptId?: string | null;
};

export type RunProgress = {
  runId: string;
  status: string;
  processedCount: number;
  totalCustomers: number;
  lastProcessedIndex: number | null;
  currentStep?: string | null;
  currentDomain?: string | null;
  substepLabel?: string | null;
  config?: RunConfigSnapshot | null;
  externalEventsSummary?: {
    domainsProcessed: number;
    domainsSkipped: number;
    articlesFetched: number;
    articlesFailed: number;
    eventsStored: number;
    errors: string[];
  };
};

/** Start a run: ingest must be stored. Creates run record, runs external events enrichment, computes signals and lift, returns runId. Call processRun(runId) to run LLM loop. */
export async function startRun(config: RunConfig): Promise<{
  runId: string;
  evaluationMonth: string;
  totalCustomers: number;
}> {
  const { eventPromptId, promptId, promptVersion, startRow } = config;

  const allCustomers = await engineDb
    .select({ id: customers.id, domain: customers.domain })
    .from(customers)
    .orderBy(customers.domain);
  const startIndex = Math.max(0, startRow - 1);
  const customerSlice = allCustomers.slice(startIndex);
  const domains = customerSlice.map((c) => c.domain);
  const totalCustomers = customerSlice.length;

  const evaluationMonth = await resolveEvaluationMonth();

  const [run] = await engineDb
    .insert(runs)
    .values({
      evaluationMonth,
      promptVersion,
      signalVersion: SIGNAL_VERSION,
      liftStatsVersion: LIFT_STATS_VERSION,
      engineVersion: ENGINE_VERSION,
      status: "running",
      totalCustomers,
      processedCount: 0,
      lastProcessedIndex: null,
      currentStep: "external_events_query_builder",
      config: {
        startRow,
        eventPromptId,
        promptId,
      } as unknown as Record<string, unknown>,
    })
    .returning();
  if (!run) {
    throw new Error("Failed to create run");
  }

  const maxDomainsEnv = process.env.EXTERNAL_EVENTS_MAX_DOMAINS;
  const maxDomains =
    maxDomainsEnv !== undefined
      ? Number.parseInt(maxDomainsEnv, 10)
      : undefined;
  const enrichmentSummary = await runExternalEventsEnrichment(run.id, domains, {
    eventPromptId: eventPromptId ?? null,
    ...(typeof maxDomains === "number" &&
    !Number.isNaN(maxDomains) &&
    maxDomains > 0
      ? { maxDomains }
      : {}),
  });
  const existingConfig = (run.config as Record<string, unknown>) ?? {};
  await engineDb
    .update(runs)
    .set({
      config: {
        ...existingConfig,
        external_events_domains_processed: enrichmentSummary.domainsProcessed,
        external_events_domains_skipped: enrichmentSummary.domainsSkipped,
        external_events_articles_fetched: enrichmentSummary.articlesFetched,
        external_events_articles_failed: enrichmentSummary.articlesFailed,
        external_events_events_stored: enrichmentSummary.eventsStored,
        external_events_errors: enrichmentSummary.errors,
      } as unknown as Record<string, unknown>,
      currentStep: "atomic_signals",
      updatedAt: new Date(),
    })
    .where(eq(runs.id, run.id));
  await appendRunLog(run.id, "info", "Computing atomic signals", {
    step: "atomic_signals",
  });

  await computeAtomicSignals(domains, evaluationMonth);
  await appendRunLog(run.id, "info", "Computing lift stats", {
    step: "lift_stats",
  });
  await computeLiftStats();

  return {
    runId: run.id,
    evaluationMonth,
    totalCustomers,
  };
}

/** Creates an enrichment run record only. Does not run enrichment. Returns runId for streaming. */
export async function createEnrichmentRun(
  domain: string,
  eventPromptId: string | null
): Promise<{ runId: string }> {
  const evaluationMonth = await resolveEvaluationMonth();
  const [run] = await engineDb
    .insert(runs)
    .values({
      evaluationMonth,
      promptVersion: null,
      signalVersion: SIGNAL_VERSION,
      liftStatsVersion: LIFT_STATS_VERSION,
      engineVersion: ENGINE_VERSION,
      status: "running",
      totalCustomers: 1,
      processedCount: 0,
      lastProcessedIndex: null,
      currentStep: "external_events_query_builder",
      config: {
        runType: "enrichment_only",
        eventPromptId,
        domain,
      } as unknown as Record<string, unknown>,
    })
    .returning();
  if (!run) {
    throw new Error("Failed to create enrichment run");
  }
  return { runId: run.id };
}

/** Runs enrichment in background. Updates run status and customer on completion. Call via after(). */
export async function runEnrichmentInBackground(
  runId: string,
  domain: string,
  eventPromptId: string | null
): Promise<void> {
  try {
    const summary = await runExternalEventsEnrichment(runId, [domain], {
      eventPromptId: eventPromptId ?? null,
    });
    const [run] = await engineDb
      .select({ config: runs.config })
      .from(runs)
      .where(eq(runs.id, runId))
      .limit(1);
    const existingConfig = (run?.config as Record<string, unknown>) ?? {};
    await engineDb
      .update(runs)
      .set({
        config: {
          ...existingConfig,
          external_events_domains_processed: summary.domainsProcessed,
          external_events_domains_skipped: summary.domainsSkipped,
          external_events_articles_fetched: summary.articlesFetched,
          external_events_articles_failed: summary.articlesFailed,
          external_events_events_stored: summary.eventsStored,
          external_events_errors: summary.errors,
        } as unknown as Record<string, unknown>,
        status: "completed",
        currentStep: null,
        currentDomain: null,
        substepLabel: null,
        updatedAt: new Date(),
      })
      .where(eq(runs.id, runId));
    const now = new Date();
    await engineDb
      .update(customers)
      .set({
        lastEnrichedAt: now,
        lastEnrichmentRunId: runId,
      })
      .where(eq(customers.domain, domain));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await appendRunLog(runId, "error", `Enrichment failed: ${msg}`, {
      domain,
      step: "external_events",
      detail: { error: msg },
    });
    await engineDb
      .update(runs)
      .set({
        status: "failed",
        currentStep: null,
        currentDomain: null,
        substepLabel: null,
        updatedAt: new Date(),
      })
      .where(eq(runs.id, runId));
  }
}

/** Enrichment-only run for a single domain. Blocks until completion. For background flow, use createEnrichmentRun + runEnrichmentInBackground. */
export async function startEnrichmentOnlyRun(
  domain: string,
  eventPromptId: string | null
): Promise<{ runId: string }> {
  const { runId } = await createEnrichmentRun(domain, eventPromptId);
  await runEnrichmentInBackground(runId, domain, eventPromptId);
  return { runId };
}

/** Evaluation-only run: no enrichment. Creates run, computes signals and lift, returns runId. Call processRun(runId) to run LLM loop. */
export async function startEvaluationOnlyRun(config: RunConfig): Promise<{
  runId: string;
  evaluationMonth: string;
  totalCustomers: number;
}> {
  const { promptId, promptVersion, startRow } = config;
  const allCustomers = await engineDb
    .select({ id: customers.id, domain: customers.domain })
    .from(customers)
    .orderBy(customers.domain);
  const startIndex = Math.max(0, startRow - 1);
  const customerSlice = allCustomers.slice(startIndex);
  const domains = customerSlice.map((c) => c.domain);
  const totalCustomers = customerSlice.length;
  const evaluationMonth = await resolveEvaluationMonth();

  const [run] = await engineDb
    .insert(runs)
    .values({
      evaluationMonth,
      promptVersion,
      signalVersion: SIGNAL_VERSION,
      liftStatsVersion: LIFT_STATS_VERSION,
      engineVersion: ENGINE_VERSION,
      status: "running",
      totalCustomers,
      processedCount: 0,
      lastProcessedIndex: null,
      currentStep: "atomic_signals",
      config: {
        runType: "evaluation_only",
        startRow,
        promptId,
      } as unknown as Record<string, unknown>,
    })
    .returning();
  if (!run) {
    throw new Error("Failed to create run");
  }
  await appendRunLog(run.id, "info", "Computing atomic signals", {
    step: "atomic_signals",
  });
  await computeAtomicSignals(domains, evaluationMonth);
  await appendRunLog(run.id, "info", "Computing lift stats", {
    step: "lift_stats",
  });
  await computeLiftStats();
  await engineDb
    .update(runs)
    .set({
      currentStep: "llm_eval",
      updatedAt: new Date(),
    })
    .where(eq(runs.id, run.id));
  return {
    runId: run.id,
    evaluationMonth,
    totalCustomers,
  };
}

/** Process run: build context + LLM per customer, update progress. Call after startRun. */
export async function processRun(runId: string): Promise<RunProgress> {
  const [run] = await engineDb.select().from(runs).where(eq(runs.id, runId));
  if (!run) {
    throw new Error("Run not found");
  }
  const config = run.config as { startRow?: number; promptId?: string } | null;
  const startRow = config?.startRow ?? 1;
  const promptId = config?.promptId ?? null;
  const promptVersion = run.promptVersion ?? "v1";
  const evaluationMonth = run.evaluationMonth;

  const allCustomers = await engineDb
    .select({ id: customers.id, domain: customers.domain })
    .from(customers)
    .orderBy(customers.domain);
  const startIndex = Math.max(0, startRow - 1);
  const customerSlice = allCustomers.slice(startIndex);
  const totalCustomers = customerSlice.length;

  const systemPrompt =
    (promptId ? await getPromptBody(promptId) : null) ??
    (await getPromptContent("ExpansionEvaluationV2")) ??
    "";

  await engineDb
    .update(runs)
    .set({
      currentStep: "llm_eval",
      currentDomain: null,
      substepLabel: null,
      updatedAt: new Date(),
    })
    .where(eq(runs.id, runId));
  await appendRunLog(runId, "info", "LLM evaluation started", {
    step: "llm_eval",
    detail: { totalCustomers },
  });

  let processedCount = 0;
  for (let i = 0; i < customerSlice.length; i++) {
    const customer = customerSlice[i];
    if (!customer) {
      continue;
    }
    await engineDb
      .update(runs)
      .set({
        currentDomain: customer.domain,
        substepLabel: `Customer ${i + 1} of ${customerSlice.length}`,
        updatedAt: new Date(),
      })
      .where(eq(runs.id, runId));

    const existing = await engineDb
      .select()
      .from(llmEvaluations)
      .where(
        and(
          eq(llmEvaluations.runId, runId),
          eq(llmEvaluations.domain, customer.domain)
        )
      )
      .limit(1);
    if (existing.length > 0) {
      processedCount += 1;
      continue;
    }
    await appendRunLog(runId, "info", `Evaluating ${customer.domain}`, {
      domain: customer.domain,
      step: "llm_eval",
    });
    const { contextJson } = await buildAndStoreContextSnapshot(
      runId,
      customer.domain,
      evaluationMonth
    );
    await evaluateWithLlm(
      runId,
      customer.domain,
      contextJson,
      systemPrompt,
      promptVersion
    );
    await appendRunLog(runId, "info", `Done ${customer.domain}`, {
      domain: customer.domain,
      step: "llm_eval",
    });
    processedCount = i + 1;
    await engineDb
      .update(runs)
      .set({
        processedCount,
        lastProcessedIndex: i,
        updatedAt: new Date(),
      })
      .where(eq(runs.id, runId));
  }

  await appendRunLog(runId, "info", "LLM evaluation finished", {
    step: "llm_eval",
    detail: { processedCount, totalCustomers },
  });
  await engineDb
    .update(runs)
    .set({
      status: "completed",
      currentStep: null,
      currentDomain: null,
      substepLabel: null,
      updatedAt: new Date(),
    })
    .where(eq(runs.id, runId));

  return {
    runId,
    status: "completed",
    processedCount,
    totalCustomers,
    lastProcessedIndex: customerSlice.length - 1,
  };
}

/** Create run and run full pipeline (ingest assumed already stored). Blocks until done. */
export async function createAndRunPipeline(config: RunConfig): Promise<{
  runId: string;
  evaluationMonth: string;
  totalCustomers: number;
}> {
  const result = await startRun(config);
  await processRun(result.runId);
  return result;
}

export type ResumeRunOptions = {
  /** When set, progress messages are sent here (e.g. for console logging). */
  onProgress?: (message: string) => void;
};

/** Resume processing for an existing run (skip already-evaluated domains). */
export async function resumeRun(
  runId: string,
  options?: ResumeRunOptions
): Promise<RunProgress> {
  const onProgress = options?.onProgress;
  const [run] = await engineDb.select().from(runs).where(eq(runs.id, runId));
  if (!run) {
    throw new Error("Run not found");
  }
  if (run.status === "completed") {
    const result = {
      runId,
      status: run.status,
      processedCount: run.processedCount ?? 0,
      totalCustomers: run.totalCustomers ?? 0,
      lastProcessedIndex: run.lastProcessedIndex,
    };
    onProgress?.(
      `Run already completed: ${result.processedCount}/${result.totalCustomers}`
    );
    return result;
  }

  const config = run.config as { startRow?: number; promptId?: string } | null;
  const startRow = config?.startRow ?? 1;
  const promptId = config?.promptId ?? null;

  const allCustomers = await engineDb
    .select({ domain: customers.domain })
    .from(customers)
    .orderBy(customers.domain);
  const startIndex = Math.max(0, startRow - 1);
  const customerSlice = allCustomers.slice(startIndex);

  const done = await engineDb
    .select({ domain: llmEvaluations.domain })
    .from(llmEvaluations)
    .where(eq(llmEvaluations.runId, runId));
  const doneSet = new Set(done.map((r) => r.domain));
  const remaining = customerSlice.filter((c) => !doneSet.has(c.domain));

  const systemPrompt =
    (promptId ? await getPromptBody(promptId) : null) ??
    (await getPromptContent("ExpansionEvaluationV2")) ??
    "";
  const evaluationMonth = run.evaluationMonth;
  const promptVersion = run.promptVersion ?? "v1";

  await engineDb
    .update(runs)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(runs.id, runId));

  let processedCount = run.processedCount ?? 0;
  let lastProcessedIndex = run.lastProcessedIndex ?? -1;
  const totalCustomers = run.totalCustomers ?? customerSlice.length;
  const baseIndex = startIndex;

  for (let i = 0; i < remaining.length; i++) {
    const customer = remaining[i];
    if (!customer) {
      continue;
    }
    const globalIndex = baseIndex + i;
    await engineDb
      .update(runs)
      .set({
        currentDomain: customer.domain,
        substepLabel: `Customer ${processedCount + 1} of ${totalCustomers}`,
        updatedAt: new Date(),
      })
      .where(eq(runs.id, runId));
    const msgEvaluating = `Evaluating ${customer.domain} (${processedCount + 1}/${totalCustomers})`;
    await appendRunLog(runId, "info", msgEvaluating, {
      domain: customer.domain,
      step: "llm_eval",
    });
    onProgress?.(msgEvaluating);
    const { contextJson } = await buildAndStoreContextSnapshot(
      runId,
      customer.domain,
      evaluationMonth
    );
    await evaluateWithLlm(
      runId,
      customer.domain,
      contextJson,
      systemPrompt,
      promptVersion
    );
    const msgDone = `Done ${customer.domain}`;
    await appendRunLog(runId, "info", msgDone, {
      domain: customer.domain,
      step: "llm_eval",
    });
    onProgress?.(msgDone);
    processedCount += 1;
    lastProcessedIndex = globalIndex;
    await engineDb
      .update(runs)
      .set({
        processedCount,
        lastProcessedIndex,
        updatedAt: new Date(),
      })
      .where(eq(runs.id, runId));
  }

  await engineDb
    .update(runs)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(runs.id, runId));

  onProgress?.(`Resume completed: ${processedCount}/${totalCustomers}`);
  return {
    runId,
    status: "completed",
    processedCount,
    totalCustomers,
    lastProcessedIndex,
  };
}

export async function getRunProgress(
  runId: string
): Promise<RunProgress | null> {
  const [run] = await engineDb.select().from(runs).where(eq(runs.id, runId));
  if (!run) {
    return null;
  }
  const config = run.config as Record<string, unknown> | null;
  const externalEventsSummary = config
    ? {
        domainsProcessed: Number(config.external_events_domains_processed ?? 0),
        domainsSkipped: Number(config.external_events_domains_skipped ?? 0),
        articlesFetched: Number(config.external_events_articles_fetched ?? 0),
        articlesFailed: Number(config.external_events_articles_failed ?? 0),
        eventsStored: Number(config.external_events_events_stored ?? 0),
        errors: Array.isArray(config.external_events_errors)
          ? (config.external_events_errors as string[])
          : [],
      }
    : undefined;
  const configSnapshot: RunProgress["config"] = config
    ? {
        startRow:
          typeof config.startRow === "number" ? config.startRow : undefined,
        eventPromptId:
          config.eventPromptId != null
            ? (config.eventPromptId as string | null)
            : undefined,
        promptId:
          config.promptId != null
            ? (config.promptId as string | null)
            : undefined,
      }
    : null;
  return {
    runId: run.id,
    status: run.status,
    processedCount: run.processedCount ?? 0,
    totalCustomers: run.totalCustomers ?? 0,
    lastProcessedIndex: run.lastProcessedIndex,
    currentStep: run.currentStep ?? null,
    currentDomain: run.currentDomain ?? null,
    substepLabel: run.substepLabel ?? null,
    config: configSnapshot,
    externalEventsSummary,
  };
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_REGEX.test(s.trim());
}

async function getPromptBody(promptId: string): Promise<string | null> {
  if (isUuid(promptId)) {
    const [dbPrompt] = await engineDb
      .select({ systemPrompt: prompts.systemPrompt })
      .from(prompts)
      .where(eq(prompts.id, promptId))
      .limit(1);
    if (dbPrompt?.systemPrompt) {
      return dbPrompt.systemPrompt;
    }
  }
  return getPromptContent(promptId);
}
