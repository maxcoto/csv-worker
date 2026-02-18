/**
 * Layer 2: Web search for external events. Uses one provider (v1: News API).
 * Stores results in external_search_results.
 */

import { engineDb } from "@/lib/engine/db/client";
import { externalSearchResults } from "@/lib/engine/db/schema";
import type { SearchQuery } from "./query-builder";

const MAX_RESULTS_PER_QUERY = 10;
const DATE_RANGE_MONTHS = 6;

export type SearchResultRow = {
  domain: string;
  query: string;
  url: string;
  title: string | null;
  snippet: string | null;
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

  return [];
}

/**
 * Run search for multiple queries and persist into external_search_results.
 */
export async function runSearchAndStore(
  domain: string,
  queries: SearchQuery[]
): Promise<SearchResultRow[]> {
  const allRows: SearchResultRow[] = [];
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
  }
  return allRows;
}
