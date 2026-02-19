import { generateText } from "ai";
import { z } from "zod";
import { getExpansionModel } from "@/lib/ai/providers";
import { SIGNAL_VERSION } from "./atomic-signals";
import type { ContextSnapshotJson } from "./context-snapshot";
import { engineDb } from "./db/client";
import { llmEvaluations } from "./db/schema";
import { LIFT_STATS_VERSION } from "./lift-stats";
import { appendRunLog } from "./run-log";

export const ENGINE_VERSION = "v1.0";

const LlmOutputSchema = z.object({
  expansion_score: z.number().min(0).max(100),
  risk_score: z.number().min(0).max(100),
  recommended_motion: z.enum(["EXPAND", "MONITOR", "SAVE"]),
  evidence_used: z.array(
    z.object({
      signal_type: z.string(),
      lift_ratio: z.number(),
      direction: z.enum(["positive_expansion", "positive_risk", "conflicting"]),
      confidence: z.enum(["high", "medium", "low"]),
    })
  ),
  why_now: z.string(),
  reasoning: z.string(),
});

export type LlmEvaluationOutput = z.infer<typeof LlmOutputSchema>;

export async function evaluateWithLlm(
  runId: string,
  domain: string,
  contextJson: ContextSnapshotJson,
  systemPrompt: string,
  promptVersion: string
): Promise<LlmEvaluationOutput> {
  const model = getExpansionModel();
  const userMessage = JSON.stringify(contextJson);

  await appendRunLog(runId, "info", "LLM evaluation input", {
    domain,
    step: "llm_eval",
    detail: {
      evaluation_month: contextJson.evaluation_context.evaluation_month,
      data_quality_score: contextJson.evaluation_context.data_quality_score,
      account_name: contextJson.account_profile.account_name,
      atomic_signals_count: contextJson.atomic_signals.length,
      historical_signal_stats_count: contextJson.historical_signal_stats.length,
      input_char_count: userMessage.length,
    },
  });

  let rawText: string;
  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      temperature: 0,
    });
    rawText = result.text;
  } catch (error) {
    throw new Error(
      `LLM call failed for ${domain}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const parsed = parseJsonOutput(rawText);
  const validated = LlmOutputSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Invalid LLM output for ${domain}: ${validated.error.message}`
    );
  }

  const out = validated.data;

  await appendRunLog(runId, "info", "LLM evaluation output", {
    domain,
    step: "llm_eval",
    detail: {
      expansion_score: out.expansion_score,
      risk_score: out.risk_score,
      recommended_motion: out.recommended_motion,
      evidence_used_count: out.evidence_used.length,
      why_now:
        out.why_now.length > 120
          ? `${out.why_now.slice(0, 117)}...`
          : out.why_now,
      reasoning_preview:
        out.reasoning.length > 80
          ? `${out.reasoning.slice(0, 77)}...`
          : out.reasoning,
    },
  });

  await engineDb.insert(llmEvaluations).values({
    runId,
    domain,
    promptVersion,
    signalVersion: SIGNAL_VERSION,
    liftStatsVersion: LIFT_STATS_VERSION,
    engineVersion: ENGINE_VERSION,
    modelName: "gpt-5.2",
    expansionScore: out.expansion_score,
    riskScore: out.risk_score,
    recommendedMotion: out.recommended_motion,
    whyNow: out.why_now,
    reasoning: out.reasoning,
    evidenceUsed: out.evidence_used as unknown as Record<string, unknown>,
    rawResponse: out as unknown as Record<string, unknown>,
  });

  return out;
}

function parseJsonOutput(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in LLM response");
  }
  const jsonStr = trimmed.slice(start, end + 1);
  return JSON.parse(jsonStr) as unknown;
}
