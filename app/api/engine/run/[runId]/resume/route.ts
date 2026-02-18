import { NextResponse } from "next/server";
import { resumeRun } from "@/lib/engine/run";

/** Resume a run that is stuck in "running" (e.g. after server restart). Processes remaining customers. */
export const maxDuration = 300;

function parseLogsParam(request: Request): boolean {
  const url = new URL(request.url);
  return url.searchParams.get("logs") === "true";
}

function verbose500(error: unknown): { status: 500; body: object } {
  const isDev = process.env.NODE_ENV === "development";
  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : "Resume failed");
  const message = err.message;
  const stack = err.stack;
  // Log full error server-side so the terminal shows it
  if (error instanceof Error) {
    // biome-ignore lint/suspicious/noConsole: intentional server-side error logging for debugging
    console.error("[resume] 500 error:", message);
    if (stack) {
      // biome-ignore lint/suspicious/noConsole: intentional stack trace for debugging
      console.error(stack);
    }
  }
  return {
    status: 500,
    body: {
      error: message,
      ...(isDev && stack ? { stack } : {}),
    },
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }
  const logToConsole = parseLogsParam(request);
  try {
    await resumeRun(runId, {
      onProgress: logToConsole
        ? (msg) => {
            // biome-ignore lint/suspicious/noConsole: optional debug logging when logs=true
            console.log(`[resume ${runId}]`, msg);
          }
        : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, body } = verbose500(error);
    return NextResponse.json(body, { status });
  }
}
