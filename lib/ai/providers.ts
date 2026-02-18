import { gateway } from "@ai-sdk/gateway";

/**
 * Returns the language model used for all three agents.
 * Abstracted so we can switch between OpenAI/Anthropic easily.
 * Uses Vercel AI Gateway for provider-agnostic model routing.
 */
export function getChatModel() {
  return gateway.languageModel("anthropic/claude-sonnet-4-20250514");
}

/**
 * Returns a faster model for simple evaluations and classifications.
 */
export function getFastModel() {
  return gateway.languageModel("openai/gpt-4o-mini");
}

/**
 * Default model for expansion evaluation (plan: GPT 5.2, temperature 0).
 */
export function getExpansionModel() {
  return gateway.languageModel("openai/gpt-5.2");
}
