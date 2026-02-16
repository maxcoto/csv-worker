import "server-only";

import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { chatMessage, type ChatMessage } from "./schema";

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

export async function saveChatMessage(data: {
  sessionId: string;
  role: string;
  content: string;
  agentType?: string;
}): Promise<ChatMessage> {
  const [result] = await db
    .insert(chatMessage)
    .values({
      sessionId: data.sessionId,
      role: data.role,
      content: data.content,
      agentType: data.agentType ?? null,
    })
    .returning();
  if (!result) throw new Error("Failed to save chat message");
  return result;
}

export async function getChatHistory(
  sessionId: string,
  limit = 100
): Promise<ChatMessage[]> {
  return db
    .select()
    .from(chatMessage)
    .where(eq(chatMessage.sessionId, sessionId))
    .orderBy(asc(chatMessage.createdAt))
    .limit(limit);
}
