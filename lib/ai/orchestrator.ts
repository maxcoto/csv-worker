import { getChatHistory, saveChatMessage } from "@/lib/db/queries";
import { runDefaultAgent } from "./agents/default";

interface StreamingResponse {
  type: "stream";
  textStream: AsyncIterable<string>;
  agentType: string;
  onStreamComplete?: (fullText: string) => Promise<void>;
}

export type OrchestratorResponse = StreamingResponse;

/**
 * Generic orchestrator: loads history, runs the default agent with optional agentId (prompt variant), returns stream.
 */
export async function orchestrate(
  sessionId: string,
  userMessage: string,
  agentId?: string
): Promise<OrchestratorResponse> {
  const history = await getChatHistory(sessionId, 50);
  const messages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  await saveChatMessage({
    sessionId,
    role: "user",
    content: userMessage,
  });

  const result = runDefaultAgent({
    messages,
    userMessage,
    agentId: agentId ?? "default",
  });

  const agentType = agentId ?? "default";

  return {
    type: "stream",
    textStream: result.textStream,
    agentType,
    onStreamComplete: async (fullText: string) => {
      if (fullText.length > 0) {
        await saveChatMessage({
          sessionId,
          role: "assistant",
          content: fullText,
          agentType,
        });
      }
    },
  };
}
