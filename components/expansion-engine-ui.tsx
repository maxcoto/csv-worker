"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExportRow } from "@/lib/engine/export-csv";

type PromptOption = {
  id: string;
  name: string;
  slug: string;
  version: string;
  source: "db" | "filesystem";
};

type CustomerRow = {
  domain: string;
  account_name: string;
  last_enriched_at: string | null;
  last_enrichment_run_id: string | null;
};

type LogEntry = {
  seq: number;
  ts: string;
  level: string;
  domain: string | null;
  step: string | null;
  message: string;
  detail?: Record<string, unknown> | null;
};

const RUN_ID_QUERY = "runId";

export function ExpansionEngineUI() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [opportunitiesCsv, setOpportunitiesCsv] = useState("");
  const [externalEventsCsv, setExternalEventsCsv] = useState("");
  const [customersCsv, setCustomersCsv] = useState("");
  const [telemetryCsv, setTelemetryCsv] = useState("");
  const [startRow, setStartRow] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [eventPromptId, setEventPromptId] = useState<string | null>(null);
  const [evaluationPromptId, setEvaluationPromptId] = useState<string | null>(
    null
  );
  const [eventPrompts, setEventPrompts] = useState<PromptOption[]>([]);
  const [evaluationPrompts, setEvaluationPrompts] = useState<PromptOption[]>(
    []
  );
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [customerList, setCustomerList] = useState<CustomerRow[]>([]);
  const [enrichingRunIdByDomain, setEnrichingRunIdByDomain] = useState<
    Record<string, string>
  >({});
  const [enrichProgressByDomain, setEnrichProgressByDomain] = useState<
    Record<
      string,
      { currentStep?: string | null; substepLabel?: string | null }
    >
  >({});
  const [expandedLogDomain, setExpandedLogDomain] = useState<string | null>(
    null
  );
  const [rowLogEntries, setRowLogEntries] = useState<
    Record<string, LogEntry[]>
  >({});
  const pathname = usePathname();
  const urlRunId = searchParams.get(RUN_ID_QUERY);
  const [runId, setRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    processedCount: number;
    totalCustomers: number;
    status: string;
    currentStep?: string | null;
    currentDomain?: string | null;
    substepLabel?: string | null;
    externalEventsSummary?: {
      domainsProcessed: number;
      domainsSkipped: number;
      articlesFetched: number;
      articlesFailed: number;
      eventsStored: number;
      errors: string[];
    };
  } | null>(null);
  const [results, setResults] = useState<ExportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [logEntries, setLogEntries] = useState<
    Array<{
      seq: number;
      ts: string;
      level: string;
      domain: string | null;
      step: string | null;
      message: string;
      detail?: Record<string, unknown> | null;
    }>
  >([]);
  const [logFollowTail, setLogFollowTail] = useState(true);
  const [lastLogSeq, setLastLogSeq] = useState(0);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const lastLogSeqRef = useRef(0);
  lastLogSeqRef.current = lastLogSeq;

  const loadPrompts = useCallback(async () => {
    const res = await fetch("/api/engine/prompts");
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as {
      eventPrompts?: PromptOption[];
      evaluationPrompts?: PromptOption[];
    };
    const events = data.eventPrompts ?? [];
    const evals = data.evaluationPrompts ?? [];
    setEventPrompts(events);
    setEvaluationPrompts(evals);
    setEventPromptId((prev) => {
      if (prev !== null) {
        return prev;
      }
      const first =
        events.find((p) => p.id === "events/ExpansionEventsV2") ?? events[0];
      return first?.id ?? null;
    });
    setEvaluationPromptId((prev) => {
      if (prev !== null) {
        return prev;
      }
      const first =
        evals.find((p) => p.id === "evaluation/ExpansionEvaluationV2") ??
        evals[0];
      return first?.id ?? null;
    });
  }, []);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsText(file);
    });

  const handleIngest = async () => {
    setError(null);
    setIngestStatus(null);
    setLoading(true);
    try {
      const res = await fetch("/api/engine/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunitiesCsv,
          externalEventsCsv,
          customersCsv,
          telemetryCsv,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        customers?: number;
        opportunities?: number;
        externalEvents?: number;
        telemetry?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Ingest failed");
        return;
      }
      setIngestStatus(
        `Ingested: ${data.customers ?? 0} customers, ${data.opportunities ?? 0} opportunities, ${data.externalEvents ?? 0} events, ${data.telemetry ?? 0} telemetry rows.`
      );
      const custRes = await fetch("/api/engine/customers");
      if (custRes.ok) {
        const custData = (await custRes.json()) as {
          customers?: CustomerRow[];
        };
        setCustomerList(custData.customers ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ingest failed");
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = useCallback(async () => {
    const res = await fetch("/api/engine/customers");
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as { customers?: CustomerRow[] };
    setCustomerList(data.customers ?? []);
  }, []);

  // Restore run from URL on load (e.g. after reload) so progress and config are not lost
  useEffect(() => {
    if (!urlRunId || runId === urlRunId) {
      return;
    }
    let cancelled = false;
    const restore = async () => {
      const res = await fetch(`/api/engine/run/${urlRunId}`);
      const data = (await res.json()) as {
        runId?: string;
        status?: string;
        processedCount?: number;
        totalCustomers?: number;
        currentStep?: string | null;
        currentDomain?: string | null;
        substepLabel?: string | null;
        config?: {
          startRow?: number;
          eventPromptId?: string | null;
          promptId?: string | null;
        } | null;
        externalEventsSummary?: {
          domainsProcessed: number;
          domainsSkipped: number;
          articlesFetched: number;
          articlesFailed: number;
          eventsStored: number;
          errors: string[];
        };
        results?: ExportRow[];
        error?: string;
      };
      if (cancelled || !res.ok || data.error) {
        return;
      }
      setRunId(data.runId ?? urlRunId);
      setProgress({
        processedCount: data.processedCount ?? 0,
        totalCustomers: data.totalCustomers ?? 0,
        status: data.status ?? "running",
        currentStep: data.currentStep ?? null,
        currentDomain: data.currentDomain ?? null,
        substepLabel: data.substepLabel ?? null,
        externalEventsSummary: data.externalEventsSummary,
      });
      if (data.results) {
        setResults(data.results);
      }
      const cfg = data.config;
      if (cfg?.eventPromptId !== undefined) {
        setEventPromptId(cfg.eventPromptId ?? null);
      }
      if (cfg?.promptId !== undefined) {
        setEvaluationPromptId(cfg.promptId ?? null);
      }
      await loadCustomers();
    };
    restore();
    return () => {
      cancelled = true;
    };
  }, [urlRunId, runId, loadCustomers]);

  const handleEnrich = async (domain: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/engine/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          eventPromptId: eventPromptId ?? null,
        }),
      });
      const data = (await res.json()) as { runId?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Enrichment failed");
        return;
      }
      const runIdEnrich = data.runId ?? null;
      if (runIdEnrich) {
        setEnrichingRunIdByDomain((prev) => ({
          ...prev,
          [domain]: runIdEnrich,
        }));
        setEnrichProgressByDomain((prev) => ({
          ...prev,
          [domain]: {
            currentStep: "external_events_query_builder",
            substepLabel: null,
          },
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrichment failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEnrichAll = async () => {
    setError(null);
    const startIndex = Math.max(0, startRow - 1);
    const domains = customerList
      .slice(startIndex)
      .map((c) => c.domain);
    const concurrency = Math.max(1, Math.floor(Number(speed)) || 1);
    let index = 0;
    const inFlight = new Set<string>();
    const runNext = async (): Promise<void> => {
      if (index >= domains.length) {
        return;
      }
      const domain = domains[index];
      index += 1;
      if (!domain || inFlight.has(domain)) {
        await runNext();
        return;
      }
      inFlight.add(domain);
      try {
        const res = await fetch("/api/engine/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain,
            eventPromptId: eventPromptId ?? null,
          }),
        });
        const data = (await res.json()) as { runId?: string };
        const runIdEnrich = data.runId ?? null;
        if (runIdEnrich) {
          setEnrichingRunIdByDomain((prev) => ({
            ...prev,
            [domain]: runIdEnrich,
          }));
          setEnrichProgressByDomain((prev) => ({
            ...prev,
            [domain]: { currentStep: "running", substepLabel: null },
          }));
          while (true) {
            const progRes = await fetch(`/api/engine/run/${runIdEnrich}`);
            const progData = (await progRes.json()) as { status?: string };
            if (progData.status === "completed") {
              break;
            }
            setEnrichProgressByDomain((prev) => ({
              ...prev,
              [domain]: {
                currentStep: progData.status,
                substepLabel: null,
              },
            }));
            await new Promise((r) => setTimeout(r, 2000));
          }
          setEnrichingRunIdByDomain((prev) => {
            const next = { ...prev };
            delete next[domain];
            return next;
          });
          setEnrichProgressByDomain((prev) => {
            const next = { ...prev };
            delete next[domain];
            return next;
          });
          await loadCustomers();
        }
      } finally {
        inFlight.delete(domain);
        if (index < domains.length || inFlight.size > 0) {
          await runNext();
        }
      }
    };
    const workers = Array.from({ length: concurrency }, () => runNext());
    await Promise.all(workers);
  };

  useEffect(() => {
    const runIds = Object.values(enrichingRunIdByDomain);
    if (runIds.length === 0) {
      return;
    }
    const t = setInterval(async () => {
      for (const [domain, id] of Object.entries(enrichingRunIdByDomain)) {
        const res = await fetch(`/api/engine/run/${id}`);
        const data = (await res.json()) as {
          status?: string;
          currentStep?: string | null;
          substepLabel?: string | null;
        };
        if (data.status === "completed") {
          setEnrichingRunIdByDomain((prev) => {
            const next = { ...prev };
            delete next[domain];
            return next;
          });
          setEnrichProgressByDomain((prev) => {
            const next = { ...prev };
            delete next[domain];
            return next;
          });
          loadCustomers();
        } else {
          setEnrichProgressByDomain((prev) => ({
            ...prev,
            [domain]: {
              currentStep: data.currentStep ?? undefined,
              substepLabel: data.substepLabel ?? undefined,
            },
          }));
        }
      }
    }, 2000);
    return () => clearInterval(t);
  }, [enrichingRunIdByDomain, loadCustomers]);

  useEffect(() => {
    if (!expandedLogDomain) {
      return;
    }
    const runIdForLog =
      enrichingRunIdByDomain[expandedLogDomain] ??
      customerList.find((c) => c.domain === expandedLogDomain)
        ?.last_enrichment_run_id;
    if (!runIdForLog) {
      setRowLogEntries((prev) => ({ ...prev, [expandedLogDomain]: [] }));
      return;
    }
    const fetchLog = async () => {
      const res = await fetch(`/api/engine/run/${runIdForLog}/log?tail=200`);
      const data = (await res.json()) as { entries?: LogEntry[] };
      const entries = data.entries ?? [];
      setRowLogEntries((prev) => ({ ...prev, [expandedLogDomain]: entries }));
    };
    fetchLog();
    const t = setInterval(fetchLog, 2000);
    return () => clearInterval(t);
  }, [expandedLogDomain, enrichingRunIdByDomain, customerList]);

  const handleEvaluate = async () => {
    setError(null);
    setRunId(null);
    setProgress(null);
    setResults([]);
    setLoading(true);
    try {
      const res = await fetch("/api/engine/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptId: evaluationPromptId ?? undefined,
          promptVersion: "v1",
          startRow: 1,
        }),
      });
      const data = (await res.json()) as {
        runId?: string;
        evaluationMonth?: string;
        totalCustomers?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Evaluation failed");
        return;
      }
      const newRunId = data.runId ?? null;
      setRunId(newRunId);
      if (newRunId) {
        router.replace(
          `${pathname}?${RUN_ID_QUERY}=${encodeURIComponent(newRunId)}`,
          { scroll: false }
        );
      }
      setLogEntries([]);
      setLastLogSeq(0);
      setProgress({
        processedCount: 0,
        totalCustomers: data.totalCustomers ?? 0,
        status: "running",
        currentStep: "atomic_signals",
        currentDomain: null,
        substepLabel: null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResumeRun = async () => {
    if (!runId) {
      return;
    }
    setResuming(true);
    setError(null);
    try {
      const res = await fetch(`/api/engine/run/${runId}/resume`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        stack?: string;
      };
      if (!res.ok) {
        const msg = data.error ?? "Resume failed";
        setError(data.stack ? `${msg}\n\n${data.stack}` : msg);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resume failed");
    } finally {
      setResuming(false);
    }
  };

  useEffect(() => {
    if (!runId) {
      return;
    }
    const t = setInterval(async () => {
      const res = await fetch(`/api/engine/run/${runId}`);
      const data = (await res.json()) as {
        runId?: string;
        status?: string;
        processedCount?: number;
        totalCustomers?: number;
        currentStep?: string | null;
        currentDomain?: string | null;
        substepLabel?: string | null;
        externalEventsSummary?: {
          domainsProcessed: number;
          domainsSkipped: number;
          articlesFetched: number;
          articlesFailed: number;
          eventsStored: number;
          errors: string[];
        };
        results?: ExportRow[];
        error?: string;
      };
      if (!res.ok || data.error) {
        return;
      }
      setProgress((prev) => ({
        ...prev,
        processedCount: data.processedCount ?? prev?.processedCount ?? 0,
        totalCustomers: data.totalCustomers ?? prev?.totalCustomers ?? 0,
        status: data.status ?? "running",
        currentStep: data.currentStep ?? prev?.currentStep ?? null,
        currentDomain: data.currentDomain ?? prev?.currentDomain ?? null,
        substepLabel: data.substepLabel ?? prev?.substepLabel ?? null,
        externalEventsSummary:
          data.externalEventsSummary ?? prev?.externalEventsSummary,
      }));
      if (data.status === "completed" && data.results) {
        setResults(data.results);
        clearInterval(t);
      }
    }, 2000);
    return () => clearInterval(t);
  }, [runId]);

  useEffect(() => {
    if (!runId) {
      return;
    }
    const mergeEntries = (
      prev: LogEntry[],
      entries: Array<{
        seq: number;
        ts: string;
        level: string;
        domain: string | null;
        step: string | null;
        message: string;
        detail?: Record<string, unknown> | null;
      }>
    ) => {
      const bySeq = new Map(prev.map((e) => [e.seq, e]));
      for (const e of entries) {
        bySeq.set(e.seq, e);
      }
      return [...bySeq.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, e]) => e);
    };
    const wsUrl =
      typeof process.env.NEXT_PUBLIC_LOG_WS_URL === "string"
        ? process.env.NEXT_PUBLIC_LOG_WS_URL.trim()
        : "";
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      const pollLog = async () => {
        const since = lastLogSeqRef.current;
        const res = await fetch(
          `/api/engine/run/${runId}/log?since=${since}&limit=500`
        );
        const data = (await res.json()) as {
          runId?: string;
          entries?: LogEntry[];
          hasMore?: boolean;
        };
        if (!res.ok || !data.entries?.length) {
          return;
        }
        setLogEntries((prev) => mergeEntries(prev, data.entries ?? []));
        const maxSeq = Math.max(
          ...(data.entries ?? []).map((e) => e.seq),
          since
        );
        setLastLogSeq(maxSeq);
        lastLogSeqRef.current = maxSeq;
      };
      pollInterval = setInterval(pollLog, 1500);
      void pollLog();
    };
    if (wsUrl) {
      const url = `${wsUrl}${wsUrl.includes("?") ? "&" : "?"}runId=${encodeURIComponent(runId)}`;
      let ws: WebSocket | null = null;
      try {
        ws = new WebSocket(url);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string) as {
              type?: string;
              entries?: LogEntry[];
            };
            if (data.type === "log" && Array.isArray(data.entries)) {
              setLogEntries((prev) => mergeEntries(prev, data.entries ?? []));
              const maxSeq = Math.max(
                ...(data.entries ?? []).map((e) => e.seq),
                lastLogSeqRef.current
              );
              setLastLogSeq(maxSeq);
              lastLogSeqRef.current = maxSeq;
            }
          } catch {
            // ignore parse errors
          }
        };
        ws.onclose = () => {
          startPolling();
        };
        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        startPolling();
      }
      return () => {
        ws?.close();
        if (pollInterval !== null) {
          clearInterval(pollInterval);
        }
      };
    }
    startPolling();
    return () => {
      if (pollInterval !== null) {
        clearInterval(pollInterval);
      }
    };
  }, [runId]);

  useEffect(() => {
    if (logFollowTail && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logFollowTail]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background via-background to-primary/5">
      <div className="mx-auto max-w-6xl space-y-8 p-6">
        <header className="pt-4">
          <h1 className="bg-primary/90 bg-clip-text text-2xl font-semibold tracking-tight text-transparent dark:bg-primary dark:bg-clip-text dark:text-transparent">
            Expansion Signal Engine
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
          Set run options and prompts, upload CSVs and ingest, enrich customers
          with external events (optional), then run evaluation. Results can be
          viewed and downloaded as CSV.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-border/80 bg-card/95 p-5 shadow-sm backdrop-blur-sm">
        <h2 className="text-lg font-medium text-foreground">1. Run configuration</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="eventPrompt">
              Event prompt (extraction)
            </label>
            <Select
              onValueChange={(v) => setEventPromptId(v || null)}
              value={eventPromptId ?? ""}
            >
              <SelectTrigger className="w-[220px]" id="eventPrompt">
                <SelectValue placeholder="Select event prompt" />
              </SelectTrigger>
              <SelectContent>
                {eventPrompts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.version})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="evaluationPrompt">
              Evaluation prompt
            </label>
            <Select
              onValueChange={(v) => setEvaluationPromptId(v || null)}
              value={evaluationPromptId ?? ""}
            >
              <SelectTrigger className="w-[220px]" id="evaluationPrompt">
                <SelectValue placeholder="Select evaluation prompt" />
              </SelectTrigger>
              <SelectContent>
                {evaluationPrompts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.version})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border/80 bg-card/95 p-5 shadow-sm backdrop-blur-sm">
        <h2 className="text-lg font-medium">2. CSV inputs</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="opps">
              Opportunities CSV
            </label>
            <Input
              accept=".csv"
              id="opps"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setOpportunitiesCsv(await readFile(f));
                }
              }}
              type="file"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="events">
              External events CSV
            </label>
            <Input
              accept=".csv"
              id="events"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setExternalEventsCsv(await readFile(f));
                }
              }}
              type="file"
            />
            <p className="text-muted-foreground text-xs">
              External events: CSV data is merged with web enrichment during the
              run.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="customers">
              Customers CSV
            </label>
            <Input
              accept=".csv"
              id="customers"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setCustomersCsv(await readFile(f));
                }
              }}
              type="file"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="telemetry">
              Telemetry CSV
            </label>
            <Input
              accept=".csv"
              id="telemetry"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setTelemetryCsv(await readFile(f));
                }
              }}
              type="file"
            />
          </div>
        </div>
        <Button
          disabled={loading || !customersCsv.trim()}
          onClick={handleIngest}
          type="button"
        >
          Upload &amp; Ingest
        </Button>
        {ingestStatus && (
          <p className="text-muted-foreground text-sm">{ingestStatus}</p>
        )}
      </section>

      {customerList.length > 0 && (
        <section className="space-y-4 rounded-xl border border-border/80 bg-card/95 p-5 shadow-sm backdrop-blur-sm">
          <h2 className="text-lg font-medium">3. Customers &amp; enrichment</h2>
          <p className="text-muted-foreground text-sm">
            Enrich each customer with external events (web search + LLM
            extraction), or run enrichment for all. Each row shows last enriched
            time and can be expanded to view logs.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="enrichStartRow">
                Start row (1-based)
              </label>
              <Input
                id="enrichStartRow"
                min={1}
                onChange={(e) =>
                  setStartRow(
                    Math.max(1, Number.parseInt(e.target.value, 10) || 1)
                  )
                }
                type="number"
                value={startRow}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="enrichSpeed">
                Speed (parallel)
              </label>
              <Input
                id="enrichSpeed"
                min={1}
                onChange={(e) =>
                  setSpeed(
                    Math.max(1, Number.parseInt(e.target.value, 10) || 1)
                  )
                }
                type="number"
                value={speed}
              />
            </div>
            <div className="flex items-end pb-2">
              <Button
                disabled={
                  loading || Object.keys(enrichingRunIdByDomain).length > 0
                }
                onClick={handleEnrichAll}
                type="button"
                variant="secondary"
              >
                Enrich all
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2">Domain</th>
                  <th className="p-2">Account</th>
                  <th className="p-2">Last enriched at</th>
                  <th className="p-2">Actions</th>
                  <th className="p-2 w-10">Status</th>
                </tr>
              </thead>
              <tbody>
                {customerList.map((c) => {
                  const isEnriching = Boolean(enrichingRunIdByDomain[c.domain]);
                  const isExpanded = expandedLogDomain === c.domain;
                  return (
                    <tr className="border-b" key={c.domain}>
                      <td className="p-2 font-mono text-xs">{c.domain}</td>
                      <td className="p-2">{c.account_name || "—"}</td>
                      <td className="p-2 text-muted-foreground">
                        {c.last_enriched_at
                          ? new Date(c.last_enriched_at).toLocaleString()
                          : "Never"}
                      </td>
                      <td className="p-2">
                        <Button
                          disabled={loading || isEnriching}
                          onClick={() => handleEnrich(c.domain)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {isEnriching ? "Enriching…" : "Enrich"}
                        </Button>
                        <Button
                          aria-expanded={isExpanded}
                          className="ml-1"
                          onClick={() =>
                            setExpandedLogDomain((prev) =>
                              prev === c.domain ? null : c.domain
                            )
                          }
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          {isExpanded ? "Hide logs" : "Logs"}
                        </Button>
                      </td>
                      <td className="p-2">
                        {isEnriching ? (
                          <span
                            className="inline-block size-4 animate-spin rounded-full border-2 border-muted border-t-primary"
                            aria-hidden
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {expandedLogDomain
            ? (() => {
                const c = customerList.find(
                  (x) => x.domain === expandedLogDomain
                );
                if (!c) {
                  return null;
                }
                const isEnriching = Boolean(enrichingRunIdByDomain[c.domain]);
                const prog = enrichProgressByDomain[c.domain];
                const rowLogs = rowLogEntries[c.domain] ?? [];
                return (
                  <div
                    className="rounded border bg-muted/20 p-3"
                    key={`log-${c.domain}`}
                  >
                    <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                      Logs for {c.domain}
                      {isEnriching && (
                        <>
                          <span
                            className="inline-block size-4 animate-spin rounded-full border-2 border-muted border-t-primary"
                            aria-hidden
                          />
                          {prog?.currentStep
                            ? ` — ${String(prog.currentStep).replace(/_/g, " ")}${prog.substepLabel ? ` (${prog.substepLabel})` : ""}`
                            : null}
                        </>
                      )}
                    </p>
                    <div className="max-h-48 overflow-y-auto font-mono text-xs">
                      {rowLogs.length === 0 ? (
                        <p className="text-muted-foreground">
                          No log entries yet.
                        </p>
                      ) : (
                        <ul className="list-none space-y-0.5">
                          {rowLogs.map((e) => (
                            <li
                              className={
                                e.level === "error"
                                  ? "text-destructive"
                                  : e.level === "warn"
                                    ? "text-amber-600"
                                    : ""
                              }
                              key={e.seq}
                            >
                              <span className="text-muted-foreground">
                                {e.ts}
                              </span>{" "}
                              <span className="font-medium">[{e.level}]</span>
                              {e.step ? ` ${e.step}` : null} {e.message}
                              {e.detail ? ` ${JSON.stringify(e.detail)}` : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })()
            : null}
        </section>
      )}

      {customerList.length > 0 && (
        <section className="rounded-xl border border-border/80 bg-card/95 p-5 shadow-sm backdrop-blur-sm">
          <h2 className="text-lg font-medium">4. Evaluation</h2>
          <p className="text-muted-foreground text-sm">
            Run the evaluation pipeline (signals, lift, LLM scoring). You can
            run this even if you did not enrich any customers.
          </p>
          <Button disabled={loading} onClick={handleEvaluate} type="button">
            Evaluation
          </Button>
        </section>
      )}

      {progress && (
        <section className="rounded-xl border border-border/80 bg-card/95 p-5 shadow-sm backdrop-blur-sm">
          <h2 className="text-lg font-medium">Process reporting</h2>
          <p className="text-muted-foreground text-sm">
            {progress.status === "running" ? (
              <>
                {progress.currentStep && (
                  <span className="font-medium">
                    {progress.currentStep.replace(/_/g, " ")}
                    {progress.currentDomain
                      ? ` — ${progress.currentDomain}`
                      : null}
                    {progress.substepLabel
                      ? ` (${progress.substepLabel})`
                      : null}
                  </span>
                )}
                {!progress.currentStep &&
                  `Processing customer ${progress.processedCount + 1} of ${progress.totalCustomers}`}
              </>
            ) : (
              `Completed: ${progress.processedCount} of ${progress.totalCustomers}`
            )}
          </p>
          {runId && progress.status === "running" && (
            <Button
              className="mt-2"
              disabled={resuming}
              onClick={handleResumeRun}
              type="button"
              variant="outline"
            >
              {resuming ? "Resuming…" : "Resume run"}
            </Button>
          )}
          {progress.status === "completed" &&
            progress.externalEventsSummary !== undefined && (
              <div className="mt-2 rounded border bg-muted/30 p-2 text-sm">
                <p className="font-medium">External events</p>
                <p className="text-muted-foreground">
                  Domains processed:{" "}
                  {progress.externalEventsSummary.domainsProcessed}
                  {progress.externalEventsSummary.domainsSkipped > 0 &&
                    `. Skipped: ${progress.externalEventsSummary.domainsSkipped}`}
                  . Articles fetched:{" "}
                  {progress.externalEventsSummary.articlesFetched}
                  {progress.externalEventsSummary.articlesFailed > 0 &&
                    `. Fetch failed: ${progress.externalEventsSummary.articlesFailed}`}
                  . Events stored: {progress.externalEventsSummary.eventsStored}
                  .
                </p>
                {progress.externalEventsSummary.errors.length > 0 && (
                  <p className="mt-1 text-destructive">
                    {progress.externalEventsSummary.errors.join(" ")}
                  </p>
                )}
              </div>
            )}
          {runId && progress.status === "completed" && (
            <a
              className="mt-2 inline-block text-sm text-primary underline"
              download
              href={`/api/engine/run/${runId}/export`}
            >
              Download CSV
            </a>
          )}
        </section>
      )}

      {runId && (
        <section className="rounded-xl border border-border/80 bg-card/95 p-5 shadow-sm backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-medium">Run log</h2>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-sm">
                <input
                  checked={logFollowTail}
                  className="rounded"
                  onChange={(e) => setLogFollowTail(e.target.checked)}
                  type="checkbox"
                />
                Follow tail
              </label>
              <Button
                onClick={() => {
                  const text = logEntries
                    .map(
                      (e) =>
                        `${e.ts} [${e.level}] ${e.domain ?? ""} ${e.step ?? ""} ${e.message} ${e.detail ? JSON.stringify(e.detail) : ""}`
                    )
                    .join("\n");
                  navigator.clipboard.writeText(text).catch(() => {
                    /* clipboard error ignored */
                  });
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Copy log
              </Button>
            </div>
          </div>
          <div
            className="max-h-80 overflow-y-auto rounded border bg-muted/20 font-mono text-xs"
            ref={logContainerRef}
          >
            {logEntries.length === 0 ? (
              <p className="p-2 text-muted-foreground">
                Log entries will appear as the run progresses.
              </p>
            ) : (
              <ul className="list-none space-y-0.5 p-2">
                {logEntries.map((e) => (
                  <li
                    className={
                      e.level === "error"
                        ? "text-destructive"
                        : e.level === "warn"
                          ? "text-amber-600"
                          : ""
                    }
                    key={e.seq}
                  >
                    <span className="text-muted-foreground">{e.ts}</span>{" "}
                    <span className="font-medium">[{e.level}]</span>
                    {e.domain ? ` ${e.domain}` : null}
                    {e.step ? ` ${e.step}` : null} {e.message}
                    {e.detail ? ` ${JSON.stringify(e.detail)}` : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {results.length > 0 && (
        <section className="space-y-4 rounded-xl border border-border/80 bg-card/95 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Results</h2>
            {runId ? (
              <a
                className="text-sm text-primary underline"
                download
                href={`/api/engine/run/${runId}/export`}
              >
                Download CSV
              </a>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Account</th>
                  <th className="p-2">Domain</th>
                  <th className="p-2">ARR</th>
                  <th className="p-2">Expansion</th>
                  <th className="p-2">Risk</th>
                  <th className="p-2">Impact</th>
                  <th className="p-2">Motion</th>
                  <th className="p-2">DQ</th>
                </tr>
              </thead>
              <tbody>
                {results.slice(0, 50).map((r, i) => (
                  <tr className="border-b" key={r.domain + String(i)}>
                    <td className="p-2">{r.account_name}</td>
                    <td className="p-2">{r.domain}</td>
                    <td className="p-2">{r.arr ?? "—"}</td>
                    <td className="p-2">{r.expansion_score ?? "—"}</td>
                    <td className="p-2">{r.risk_score ?? "—"}</td>
                    <td className="p-2">{r.impact_score.toFixed(1)}</td>
                    <td className="p-2">{r.recommended_motion ?? "—"}</td>
                    <td className="p-2">{r.data_quality_score ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {results.length > 50 && (
            <p className="text-muted-foreground text-sm">
              Showing first 50 of {results.length}. Use CSV download for full
              list.
            </p>
          )}
        </section>
      )}

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
      </div>
    </div>
  );
}
