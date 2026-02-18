/**
 * Layer 3: Fetch article HTML, clean (strip scripts/styles), extract text, store.
 */

import { load as loadCheerio } from "cheerio";
import { engineDb } from "@/lib/engine/db/client";
import { externalArticlesRaw } from "@/lib/engine/db/schema";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_ARTICLE_CHARS = 15_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB
const RETRIES = 2;

export type FetchedArticle = {
  domain: string;
  url: string;
  articleText: string;
  publishedDate: string | null;
};

function isPdfUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith(".pdf");
  } catch {
    return false;
  }
}

async function fetchWithRetry(
  url: string,
  retriesLeft: number
): Promise<{ ok: boolean; text: string; date: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "ExpansionSignalBot/1.0 (external events enrichment; no LinkedIn)",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return { ok: false, text: "", date: null };
    }
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (contentType.includes("application/pdf")) {
      return { ok: false, text: "", date: null };
    }
    const contentLength = res.headers.get("content-length");
    if (
      contentLength &&
      Number.parseInt(contentLength, 10) > MAX_RESPONSE_BYTES
    ) {
      return { ok: false, text: "", date: null };
    }
    const text = await res.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      return { ok: false, text: "", date: null };
    }
    const lastMod = res.headers.get("last-modified");
    const date =
      lastMod !== null ? new Date(lastMod).toISOString().slice(0, 10) : null;
    return { ok: true, text, date };
  } catch {
    clearTimeout(timeout);
    if (retriesLeft > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return fetchWithRetry(url, retriesLeft - 1);
    }
    return { ok: false, text: "", date: null };
  }
}

/**
 * Extract visible text from HTML: remove script/style, get text, truncate.
 */
export function cleanHtmlToText(html: string): string {
  const $ = loadCheerio(html);
  $("script, style, noscript, iframe").remove();
  const text = $("body").text() || $("html").text() || "";
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length > MAX_ARTICLE_CHARS) {
    return normalized.slice(0, MAX_ARTICLE_CHARS);
  }
  return normalized;
}

/**
 * Try to get published date from meta/og tags.
 */
function extractPublishedDate(html: string): string | null {
  const $ = loadCheerio(html);
  const selectors = [
    'meta[property="article:published_time"]',
    'meta[name="date"]',
    'meta[name="publishdate"]',
    "time[datetime]",
  ];
  for (const sel of selectors) {
    const el = $(sel).first();
    const content = el.attr("content") ?? el.attr("datetime");
    if (content) {
      try {
        const d = new Date(content);
        return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      } catch {
        // ignore
      }
    }
  }
  return null;
}

/**
 * Fetch one URL, clean, and return article data. Returns null if fetch failed or PDF/skip.
 */
export async function fetchAndCleanArticle(
  domain: string,
  url: string
): Promise<FetchedArticle | null> {
  if (isPdfUrl(url)) {
    return null;
  }
  const { ok, text, date } = await fetchWithRetry(url, RETRIES);
  if (!ok || !text) {
    return null;
  }
  const articleText = cleanHtmlToText(text);
  if (articleText.length < 100) {
    return null;
  }
  const publishedDate = extractPublishedDate(text) ?? date;
  return {
    domain,
    url,
    articleText,
    publishedDate,
  };
}

/**
 * Fetch multiple URLs (up to maxPerDomain), dedupe by URL, store in external_articles_raw.
 */
export async function fetchAndStoreArticles(
  domain: string,
  urls: string[],
  maxPerDomain: number
): Promise<FetchedArticle[]> {
  const seen = new Set<string>();
  const results: FetchedArticle[] = [];
  for (const url of urls) {
    if (results.length >= maxPerDomain) {
      break;
    }
    const norm = url.trim();
    if (!norm || seen.has(norm)) {
      continue;
    }
    seen.add(norm);
    const article = await fetchAndCleanArticle(domain, norm);
    if (article) {
      results.push(article);
      await engineDb.insert(externalArticlesRaw).values({
        domain: article.domain,
        url: article.url,
        articleText: article.articleText,
        publishedDate: article.publishedDate,
      });
    }
  }
  return results;
}
