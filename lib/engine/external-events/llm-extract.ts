/**
 * Layer 4: LLM extraction of structured events from article text.
 * Output is passed to Layer 5 (dedupe and store).
 * Event types align with Expansion Evaluation taxonomy (ExpansionEvaluationV2):
 * risk = Executive departures (EXEC_DEPARTURE_LD), Layoffs (LAYOFF).
 */

import { generateText } from "ai";
import { z } from "zod";
import { getExpansionModel } from "@/lib/ai/providers";
import { getPromptContent } from "@/lib/prompts/load-prompts";

/** Event type strings; must match ExpansionEventsV2 prompt and Expansion Evaluation taxonomy. */
export const EXTERNAL_EVENT_TYPES = [
  "EXEC_HIRE_LD",
  "EXEC_DEPARTURE_LD",
  "LAYOFF",
  "HEADCOUNT_GROWTH",
  "HEADCOUNT_DECLINE",
] as const;

export type ExternalEventType = (typeof EXTERNAL_EVENT_TYPES)[number];

const ExtractedEventSchema = z.object({
  event_type: z.enum(EXTERNAL_EVENT_TYPES),
  event_ts: z.string(),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
});

const LlmOutputSchema = z.object({
  events: z.array(ExtractedEventSchema),
});

export type ExtractedEvent = z.infer<typeof ExtractedEventSchema>;

export type ExternalEventRow = {
  domain: string;
  eventType: ExternalEventType;
  eventTs: string;
  source: string | null;
  sourceUrl: string | null;
  payloadJson: Record<string, unknown>;
  confidence: number;
};

function parseJsonOutput(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object in response");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const DEFAULT_EVENT_PROMPT_ID = "events/ExpansionEventsV2";

/**
 * Call LLM to extract events from one article. Returns rows ready for Layer 5 (dedupe/store).
 */
export async function extractEventsFromArticle(
  domain: string,
  articleText: string,
  sourceUrl: string,
  publishedDate: string | null,
  eventPromptId?: string | null
): Promise<ExternalEventRow[]> {
  const systemPrompt =
    getPromptContent(eventPromptId ?? DEFAULT_EVENT_PROMPT_ID) ??
    "You extract structured events from article text. Return JSON: { events: [] }.";
  const userMessage = JSON.stringify({
    domain,
    article_text: articleText.slice(0, 15_000),
    source_url: sourceUrl,
    published_date: publishedDate,
  });

  const result = await generateText({
    model: getExpansionModel(),
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    temperature: 0,
  });

  const parsed = parseJsonOutput(result.text);
  const validated = LlmOutputSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Invalid LLM output: ${validated.error.message}`);
  }

  const source = hostnameFromUrl(sourceUrl);
  const rows: ExternalEventRow[] = [];
  for (const ev of validated.data.events) {
    if (ev.confidence < 0.6) {
      continue;
    }
    rows.push({
      domain,
      eventType: ev.event_type,
      eventTs: ev.event_ts,
      source,
      sourceUrl,
      payloadJson: { summary: ev.summary, confidence: ev.confidence },
      confidence: ev.confidence,
    });
  }
  return rows;
}
