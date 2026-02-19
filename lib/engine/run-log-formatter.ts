/**
 * Human-readable formatter for run log entries.
 * Used when NEXT_PUBLIC_LOG_DISPLAY=human (default).
 */

import type { RunLogEntryDto } from "./run-log";

function num(x: unknown): number {
  if (typeof x === "number" && Number.isFinite(x)) {
    return x;
  }
  return 0;
}

function str(x: unknown): string {
  if (x == null) {
    return "";
  }
  return String(x);
}

export function humanizeLogEntry(entry: RunLogEntryDto): string {
  const { level, domain, step, message, detail } = entry;
  const d = detail ?? {};
  const domainPart = domain ? ` for ${domain}` : "";
  const domainColon = domain ? `${domain}: ` : "";

  if (level === "warn" && message.startsWith("Search failed for")) {
    return message;
  }
  if (
    level === "error" &&
    message.startsWith("Domain ") &&
    message.includes(" failed:")
  ) {
    return message;
  }

  switch (step) {
    case "external_events":
      if (message === "External events enrichment started") {
        const max = num(d.maxDomains);
        const count = num(d.domainCount);
        return `Starting external events enrichment for ${count} domain${count === 1 ? "" : "s"}${max > 0 ? ` (max ${max})` : ""}.`;
      }
      if (message === "External events enrichment finished") {
        const s = d as { domainsProcessed?: number; eventsStored?: number };
        const domains = num(s.domainsProcessed);
        const events = num(s.eventsStored);
        return `Enrichment finished: ${domains} domain${domains === 1 ? "" : "s"} processed, ${events} event${events === 1 ? "" : "s"} stored.`;
      }
      break;

    case "external_events_query_builder":
      if (message.startsWith("Queries built for ")) {
        const count = num(d.count);
        return `Built ${count} search quer${count === 1 ? "y" : "ies"}${domainPart}.`;
      }
      break;

    case "external_events_search":
      if (message.startsWith("Search query: ")) {
        const category = str(d.category);
        const query = str(d.query);
        const resultCount = num(d.resultCount);
        const queryPart = query ? ` "${query}"` : "";
        return `Searched for ${category}${queryPart}: found ${resultCount} result${resultCount === 1 ? "" : "s"}.`;
      }
      if (message.startsWith("Search results for ")) {
        const urlCount = num(d.urlCount);
        return `Found ${urlCount} article${urlCount === 1 ? "" : "s"}${domainPart}.`;
      }
      break;

    case "external_events_fetch":
      if (message === "Article fetch") {
        const status = str(d.status);
        const reason = str(d.reason);
        const url = str(d.url);
        const shortUrl = url.length > 50 ? `${url.slice(0, 47)}...` : url;
        if (reason) {
          return `Skipped article (${reason}): ${shortUrl}`;
        }
        return `Fetched article: ${status} — ${shortUrl}`;
      }
      break;

    case "external_events_extract":
      if (message === "LLM extract input") {
        const len = num(d.articleTextLength);
        return `Extracting events from article (${len.toLocaleString()} chars).`;
      }
      if (message === "LLM extract output") {
        const events = Array.isArray(d.events) ? d.events : [];
        return `Extracted ${events.length} event${events.length === 1 ? "" : "s"} from article.`;
      }
      if (message.startsWith("Article extracted: ")) {
        const extracted = num(
          (d as { eventsExtracted?: number }).eventsExtracted
        );
        const stored = num((d as { eventsStored?: number }).eventsStored);
        return `Article done: ${extracted} event${extracted === 1 ? "" : "s"} extracted, ${stored} stored.`;
      }
      break;

    case "external_events_dedupe_store":
      if (message === "Dedupe skip") {
        const reason = str(d.reason);
        const eventType = str(d.event_type);
        const eventTs = str(d.event_ts);
        return `Skipped duplicate event (${reason || "already stored"}): ${eventType} at ${eventTs}`;
      }
      if (message === "Dedupe insert") {
        const eventType = str(d.event_type);
        const eventTs = str(d.event_ts);
        return `Stored new event: ${eventType} at ${eventTs}`;
      }
      if (message.startsWith("Domain ") && message.endsWith(" completed")) {
        const articles = num(d.articlesFetched);
        const events = num(d.eventsFromDomain);
        return `Completed${domainPart}: ${articles} article${articles === 1 ? "" : "s"}, ${events} event${events === 1 ? "" : "s"} stored.`;
      }
      break;

    case "atomic_signals":
      if (message === "Computing atomic signals") {
        return "Computing atomic signals.";
      }
      break;

    case "lift_stats":
      if (message === "Computing lift stats") {
        return "Computing lift stats.";
      }
      break;

    case "llm_eval":
      if (message === "LLM evaluation started") {
        const total = num(d.totalCustomers);
        return `Starting LLM evaluation for ${total} customer${total === 1 ? "" : "s"}.`;
      }
      if (message.startsWith("Evaluating ")) {
        return `Evaluating ${domain ?? "customer"}.`;
      }
      if (message.startsWith("Done ")) {
        return `Finished evaluating ${domain ?? "customer"}.`;
      }
      if (message === "LLM evaluation finished") {
        const s = d as { processedCount?: number; totalCustomers?: number };
        const processed = num(s.processedCount);
        const total = num(s.totalCustomers);
        return `LLM evaluation done: ${processed} of ${total} customers.`;
      }
      break;

    default:
      break;
  }

  if (message) {
    if (domain) {
      return `${domainColon}${message}`;
    }
    return message;
  }

  const fallback =
    level === "error"
      ? `Error${domainPart}`
      : level === "warn"
        ? `Warning${domainPart}`
        : "Info";
  return detail && Object.keys(detail).length > 0
    ? `${fallback}: ${JSON.stringify(detail)}`
    : fallback;
}
