import { generateText } from "ai";
import { getPromptContent } from "@/lib/prompts/load-prompts";
import { getChatModel } from "./providers";

/**
 * Runs a single data prompt: system = .md file content, user = message + spreadsheet content.
 * Returns full text (expected to be CSV). Non-streaming.
 */
export async function runDataPrompt(
  promptId: string,
  userMessage: string,
  dataContent: string
): Promise<string> {
  const systemContent = getPromptContent(promptId);
  const systemPrompt =
    systemContent ??
    "You are a data assistant. Respond with a valid CSV when the user provides data.";

  const userPrompt = `${userMessage}

Data (CSV or table):

${dataContent}`;

  const result = await generateText({
    model: getChatModel(),
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  return result.text;
}
