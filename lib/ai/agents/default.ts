import { streamText } from "ai";
import { getSystemPrompt } from "../prompts";
import { getChatModel } from "../providers";

interface DefaultAgentInput {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  agentId?: string;
}

/**
 * Default generic agent. Streams the response.
 */
export function runDefaultAgent(input: DefaultAgentInput) {
  const { messages, userMessage, agentId = "default" } = input;
  const systemPrompt = getSystemPrompt(agentId);

  return streamText({
    model: getChatModel(),
    system: systemPrompt,
    messages: [
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userMessage },
    ],
  });
}
