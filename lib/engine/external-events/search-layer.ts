/**
 * Layer 2: Web search for external events. Uses one provider (v1: News API).
 * Stores results in external_search_results.
 */

import { engineDb } from "@/lib/engine/db/client";
import { externalSearchResults } from "@/lib/engine/db/schema";
import type { SearchQuery } from "./query-builder";

const MAX_RESULTS_PER_QUERY = 10;
const DATE_RANGE_MONTHS = 6;
const DATE_RANGE_MONTHS_GOOGLE = 12; // 6–12 months; Google uses dateRestrict

export type SearchResultRow = {
  domain: string;
  query: string;
  url: string;
  title: string | null;
  snippet: string | null;
};

export type SearchResultRowWithTs = SearchResultRow & {
  search_ts: string;
};

/**
 * News API v2 everything endpoint. Requires EXTERNAL_EVENTS_NEWS_API_KEY.
 */
async function searchNewsApi(
  query: string,
  fromDate: string,
  toDate: string
): Promise<{ url: string; title: string; description: string }[]> {
  const apiKey = process.env.EXTERNAL_EVENTS_NEWS_API_KEY;
  if (!apiKey) {
    return [];
  }
  const params = new URLSearchParams({
    q: query,
    from: fromDate,
    to: toDate,
    pageSize: String(MAX_RESULTS_PER_QUERY),
    language: "en",
    apiKey,
  });
  const url = `https://newsapi.org/v2/everything?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`News API error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    articles?: Array<{
      url?: string;
      title?: string;
      description?: string;
    }>;
  };
  const articles = data.articles ?? [];
  return articles
    .filter((a) => a.url)
    .map((a) => ({
      url: a.url ?? "",
      title: a.title ?? "",
      description: a.description ?? "",
    }));
}

function getDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - DATE_RANGE_MONTHS);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function isPublicUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.startsWith("file:") || trimmed.startsWith("javascript:")) {
    return false;
  }
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Google Custom Search JSON API. Requires EXTERNAL_EVENTS_GOOGLE_CSE_KEY and EXTERNAL_EVENTS_GOOGLE_CSE_CX.
 * dateRestrict: m6 or m12 for last 6–12 months; num: 5–10 results.
 */
async function searchGoogleCustomSearch(
  query: string,
  num: number
): Promise<{ url: string; title: string; snippet: string }[]> {
  const apiKey = process.env.EXTERNAL_EVENTS_GOOGLE_CSE_KEY;
  const cx = process.env.EXTERNAL_EVENTS_GOOGLE_CSE_CX;
  if (!apiKey || !cx) {
    throw new Error(
      "Google Custom Search requires EXTERNAL_EVENTS_GOOGLE_CSE_KEY and EXTERNAL_EVENTS_GOOGLE_CSE_CX"
    );
  }
  const months = Math.min(
    12,
    Math.max(6, DATE_RANGE_MONTHS_GOOGLE)
  );
  const dateRestrict = `m${months}`;
  const params = new URLSearchParams({
    key: apiKey,
    cx,
    q: query,
    num: String(Math.min(10, Math.max(1, num))),
    dateRestrict,
  });
  const apiUrl = `https://customsearch.googleapis.com/customsearch/v1?${params.toString()}`;
  const res = await fetch(apiUrl);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Google Custom Search error ${res.status}: ${text.slice(0, 200)}`
    );
  }
  const data = (await res.json()) as {
    items?: Array<{
      link?: string;
      title?: string;
      snippet?: string;
    }>;
  };
  const items = data.items ?? [];
  return items
    .filter((item) => item.link && isPublicUrl(item.link))
    .map((item) => ({
      url: item.link ?? "",
      title: item.title ?? "",
      snippet: item.snippet ?? "",
    }));
}

/**
 * Run search for one query and return rows (not yet persisted).
 */
export async function runSearchQuery(
  domain: string,
  searchQuery: SearchQuery
): Promise<SearchResultRow[]> {
  const provider = process.env.EXTERNAL_EVENTS_SEARCH_PROVIDER ?? "newsapi";
  const { from, to } = getDateRange();

  if (provider === "newsapi") {
    const articles = await searchNewsApi(searchQuery.query, from, to);
    return articles.map((a) => ({
      domain,
      query: searchQuery.query,
      url: a.url,
      title: a.title || null,
      snippet: a.description || null,
    }));
  }

  if (provider === "google") {
    const items = await searchGoogleCustomSearch(
      searchQuery.query,
      MAX_RESULTS_PER_QUERY
    );
    return items.map((a) => ({
      domain,
      query: searchQuery.query,
      url: a.url,
      title: a.title || null,
      snippet: a.snippet || null,
    }));
  }

  return [];
}

export type RunSearchAndStoreOptions = {
  /** Called after each query with category, query text, and persisted rows (with search_ts). */
  onQueryDone?: (
    category: string,
    query: string,
    rows: SearchResultRowWithTs[]
  ) => Promise<void>;
};

/**
 * Run search for multiple queries and persist into external_search_results.
 */
export async function runSearchAndStore(
  domain: string,
  queries: SearchQuery[],
  options?: RunSearchAndStoreOptions
): Promise<SearchResultRow[]> {
  const allRows: SearchResultRow[] = [];
  const searchTs = new Date();
  const searchTsIso = searchTs.toISOString();
  for (const q of queries) {
    const rows = await runSearchQuery(domain, q);
    for (const row of rows) {
      allRows.push(row);
      await engineDb.insert(externalSearchResults).values({
        domain: row.domain,
        query: row.query,
        url: row.url,
        title: row.title,
        snippet: row.snippet,
      });
    }
    const rowsWithTs: SearchResultRowWithTs[] = rows.map((r) => ({
      ...r,
      search_ts: searchTsIso,
    }));
    await options?.onQueryDone?.(q.category, q.query, rowsWithTs);
  }
  return allRows;
}
