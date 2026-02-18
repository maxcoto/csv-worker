/**
 * External events enrichment: runs Layers 1–5 for the given domains as part of the main run.
 * Updates run progress and run_log; invoked from startRun() before atomic signals.
 */

import { eq } from "drizzle-orm";
import { engineDb } from "@/lib/engine/db/client";
import { customers, runs } from "@/lib/engine/db/schema";
import { appendRunLog, resetRunLogSeq } from "@/lib/engine/run-log";
import { fetchAndStoreArticles } from "./article-fetch";
import { dedupeAndStore } from "./dedupe-and-store";
import { extractEventsFromArticle } from "./llm-extract";
import { buildSearchQueries } from "./query-builder";
import { runSearchAndStore } from "./search-layer";

const MAX_DOMAINS_DEFAULT = 50;
const MAX_ARTICLES_PER_DOMAIN = 20;

export type EnrichmentSummary = {
  domainsProcessed: number;
  domainsSkipped: number;
  articlesFetched: number;
  articlesFailed: number;
  eventsStored: number;
  errors: string[];
};

export async function runExternalEventsEnrichment(
  runId: string,
  domains: string[],
  options?: { maxDomains?: number; eventPromptId?: string | null }
): Promise<EnrichmentSummary> {
  resetRunLogSeq(runId);
  const maxDomains = options?.maxDomains ?? MAX_DOMAINS_DEFAULT;
  const eventPromptId = options?.eventPromptId ?? null;
  const summary: EnrichmentSummary = {
    domainsProcessed: 0,
    domainsSkipped: 0,
    articlesFetched: 0,
    articlesFailed: 0,
    eventsStored: 0,
    errors: [],
  };

  await appendRunLog(runId, "info", "External events enrichment started", {
    step: "external_events",
    detail: { maxDomains, domainCount: domains.length },
  });

  const domainSlice = domains.slice(0, maxDomains);

  for (let d = 0; d < domainSlice.length; d++) {
    const domain = domainSlice[d];
    if (!domain) {
      continue;
    }

    await engineDb
      .update(runs)
      .set({
        currentStep: "external_events_search",
        currentDomain: domain,
        substepLabel: `Domain ${d + 1} of ${domainSlice.length}`,
        updatedAt: new Date(),
      })
      .where(eq(runs.id, runId));

    const [cust] = await engineDb
      .select({ accountName: customers.accountName })
      .from(customers)
      .where(eq(customers.domain, domain))
      .limit(1);
    const accountName = cust?.accountName ?? "";

    try {
      const queries = buildSearchQueries(domain, accountName);
      await appendRunLog(runId, "info", `Queries built for ${domain}`, {
        domain,
        step: "external_events_query_builder",
        detail: { count: queries.length },
      });

      let searchRows: { url: string }[] = [];
      try {
        searchRows = await runSearchAndStore(
          domain,
          queries.map((q) => ({ query: q.query, category: q.category })),
          {
            onQueryDone: async (category, query, rows) => {
              await appendRunLog(
                runId,
                "info",
                `Search query: ${category}`,
                {
                  domain,
                  step: "external_events_search",
                  detail: {
                    query,
                    category,
                    resultCount: rows.length,
                    rows,
                  },
                }
              );
            },
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        summary.errors.push(`${domain}: search failed - ${msg}`);
        summary.domainsSkipped += 1;
        await appendRunLog(
          runId,
          "warn",
          `Search failed for ${domain}: ${msg}`,
          {
            domain,
            step: "external_events_search",
            detail: { error: msg },
          }
        );
        continue;
      }

      const urls = searchRows.map((r) => r.url);
      await appendRunLog(runId, "info", `Search results for ${domain}`, {
        domain,
        step: "external_events_search",
        detail: { urlCount: urls.length, urls: urls.slice(0, 10) },
      });
      await engineDb
        .update(runs)
        .set({
          currentStep: "external_events_fetch",
          substepLabel: `Fetching articles for ${domain}`,
          updatedAt: new Date(),
        })
        .where(eq(runs.id, runId));

      const articles = await fetchAndStoreArticles(
        domain,
        urls,
        MAX_ARTICLES_PER_DOMAIN,
        {
          onUrlResult: (url, status, reason, articleTextLength) => {
            void appendRunLog(runId, "info", "Article fetch", {
              domain,
              step: "external_events_fetch",
              detail: {
                url,
                status,
                ...(reason !== undefined && { reason }),
                ...(articleTextLength !== undefined && {
                  articleTextLength,
                }),
              },
            });
          },
        }
      );
      summary.articlesFetched += articles.length;
      if (urls.length > articles.length) {
        summary.articlesFailed += urls.length - articles.length;
      }

      for (let a = 0; a < articles.length; a++) {
        const art = articles[a];
        if (!art) {
          continue;
        }
        await engineDb
          .update(runs)
          .set({
            currentStep: "external_events_extract",
            substepLabel: `Article ${a + 1}/${articles.length}: ${domain}`,
            updatedAt: new Date(),
          })
          .where(eq(runs.id, runId));

        try {
          await appendRunLog(runId, "info", "LLM extract input", {
            domain,
            step: "external_events_extract",
            detail: {
              source_url: art.url,
              published_date: art.publishedDate,
              articleTextLength: art.articleText.length,
            },
          });
          const eventRows = await extractEventsFromArticle(
            domain,
            art.articleText,
            art.url,
            art.publishedDate,
            eventPromptId
          );
          await appendRunLog(runId, "info", "LLM extract output", {
            domain,
            step: "external_events_extract",
            detail: {
              events: eventRows.map((r) => ({
                event_type: r.eventType,
                event_ts: r.eventTs,
                confidence: r.confidence,
                summary: (r.payloadJson as { summary?: string })?.summary,
              })),
              url: art.url,
            },
          });
          const inserted = await dedupeAndStore(eventRows, {
            onSkip: (d, eventType, eventTs, reason) => {
              void appendRunLog(runId, "info", "Dedupe skip", {
                domain: d,
                step: "external_events_dedupe_store",
                detail: { event_type: eventType, event_ts: eventTs, reason },
              });
            },
            onInsert: (d, eventType, eventTs) => {
              void appendRunLog(runId, "info", "Dedupe insert", {
                domain: d,
                step: "external_events_dedupe_store",
                detail: { event_type: eventType, event_ts: eventTs },
              });
            },
          });
          summary.eventsStored += inserted;
          await appendRunLog(runId, "info", `Article extracted: ${art.url}`, {
            domain,
            step: "external_events_extract",
            detail: {
              eventsExtracted: eventRows.length,
              eventsStored: inserted,
              url: art.url,
            },
          });
        } catch {
          summary.articlesFailed += 1;
        }
      }

      await appendRunLog(runId, "info", `Domain ${domain} completed`, {
        domain,
        step: "external_events_dedupe_store",
        detail: {
          articlesFetched: articles.length,
          eventsFromDomain: summary.eventsStored,
        },
      });
      summary.domainsProcessed += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`${domain}: ${msg}`);
      summary.domainsSkipped += 1;
      await appendRunLog(runId, "error", `Domain ${domain} failed: ${msg}`, {
        domain,
        step: "external_events",
        detail: { error: msg },
      });
    }
  }

  await appendRunLog(runId, "info", "External events enrichment finished", {
    step: "external_events",
    detail: summary as unknown as Record<string, unknown>,
  });

  return summary;
}
