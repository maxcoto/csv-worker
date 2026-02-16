/**
 * Generic system prompts for chatbot agents.
 */

export const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant. Be concise, clear, and accurate.`;

export const ANALYST_SYSTEM_PROMPT = `You are an analytical assistant. Focus on reasoning, structure, and evidence. Break down complex questions and summarize key points.`;

export const WRITER_SYSTEM_PROMPT = `You are a writing assistant. Help with clarity, tone, and structure. Prefer clear, well-organized prose.`;

export const AGENT_PROMPTS: Record<string, string> = {
  default: DEFAULT_SYSTEM_PROMPT,
  analyst: ANALYST_SYSTEM_PROMPT,
  writer: WRITER_SYSTEM_PROMPT,
};

export const AGENT_IDS = ["default", "analyst", "writer"] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export function getSystemPrompt(agentId: string): string {
  return AGENT_PROMPTS[agentId] ?? DEFAULT_SYSTEM_PROMPT;
}
