import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildSessionCookieHeader,
  createSessionId,
  getSessionIdFromRequest,
} from "@/lib/auth/session";
import { runDataPrompt } from "@/lib/ai/run-data-prompt";
import { orchestrate } from "@/lib/ai/orchestrator";

export const maxDuration = 60;

const attachmentSchema = z.object({
  type: z.enum(["csv", "text"]),
  content: z.string().max(500_000),
  filename: z.string().max(256).optional(),
});

const requestSchema = z.object({
  message: z.string().min(1).max(10_000),
  agentId: z.string().max(64).optional(),
  promptId: z.string().max(64).optional(),
  attachment: attachmentSchema.optional(),
});

/**
 * POST /api/chat
 * Body: { message, agentId? }
 * Session via cookie (session_id). If missing, a new session ID is set in the response.
 */
export async function POST(request: Request) {
  try {
    const fromCookie = getSessionIdFromRequest(request);
    const sessionId = fromCookie ?? createSessionId();
    const isNewSession = fromCookie === null;

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid message" },
        { status: 400 }
      );
    }

    const { message, agentId, promptId, attachment } = parsed.data;

    // Data flow: attachment + promptId → use .md prompt and return CSV result as JSON
    if (attachment && promptId) {
      const resultText = await runDataPrompt(
        promptId,
        message,
        attachment.content
      );

      const response = NextResponse.json({ result: resultText });

      if (isNewSession) {
        response.headers.set(
          "Set-Cookie",
          buildSessionCookieHeader(sessionId)
        );
      }
      return response;
    }

    const result = await orchestrate(sessionId, message, agentId);

    const encoder = new TextEncoder();
    let fullText = "";
    const onComplete = result.onStreamComplete;

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            fullText += chunk;
            controller.enqueue(
              encoder.encode(`0:${JSON.stringify(chunk)}\n`)
            );
          }
        } catch (error) {
          console.error("Stream error:", error);
        } finally {
          controller.close();
          if (onComplete && fullText.length > 0) {
            onComplete(fullText).catch((err) => {
              console.error("Failed to save streamed message:", err);
            });
          }
        }
      },
    });

    const response = new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Agent-Type": result.agentType,
      },
    });

    if (isNewSession && sessionId) {
      response.headers.set("Set-Cookie", buildSessionCookieHeader(sessionId));
    }

    return response;
  } catch (error) {
    console.error("Chat API error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
