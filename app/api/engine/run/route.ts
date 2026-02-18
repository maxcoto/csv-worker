import { NextResponse } from "next/server";
import { processRun, startRun } from "@/lib/engine/run";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      eventPromptId?: string | null;
      promptId?: string | null;
      promptVersion?: string;
      startRow?: number;
    };
    const eventPromptId = body.eventPromptId ?? null;
    const promptId = body.promptId ?? null;
    const promptVersion = body.promptVersion ?? "v1";
    const startRow = Math.max(1, body.startRow ?? 1);

    const result = await startRun({
      eventPromptId,
      promptId,
      promptVersion,
      startRow,
    });

    processRun(result.runId).catch(() => {
      // Progress and errors are reflected in run status; no need to rethrow
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Run failed",
      },
      { status: 500 }
    );
  }
}
