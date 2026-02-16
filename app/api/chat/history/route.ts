import { NextResponse } from "next/server";
import {
  buildSessionCookieHeader,
  createSessionId,
  getSessionIdFromRequest,
} from "@/lib/auth/session";
import { getChatHistory } from "@/lib/db/queries";

/**
 * GET /api/chat/history
 * Returns chat messages for the current session (cookie session_id).
 * If no cookie, sets a new session and returns empty messages.
 */
export async function GET(request: Request) {
  try {
    const fromCookie = getSessionIdFromRequest(request);
    const sessionId = fromCookie ?? createSessionId();
    const isNewSession = fromCookie === null;

    const messages = await getChatHistory(sessionId, 200);

    const displayMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        agentType: m.agentType,
        createdAt: m.createdAt,
      }));

    const response = NextResponse.json({ messages: displayMessages });

    if (isNewSession) {
      response.headers.set("Set-Cookie", buildSessionCookieHeader(sessionId));
    }

    return response;
  } catch (error) {
    console.error("Chat history API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
