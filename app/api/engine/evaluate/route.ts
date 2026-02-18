import { NextResponse } from "next/server";
import { processRun, startEvaluationOnlyRun } from "@/lib/engine/run";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      promptId?: string | null;
      promptVersion?: string;
      startRow?: number;
    };
    const promptId = body.promptId ?? null;
    const promptVersion = body.promptVersion ?? "v1";
    const startRow = Math.max(1, body.startRow ?? 1);

    const result = await startEvaluationOnlyRun({
      eventPromptId: null,
      promptId,
      promptVersion,
      startRow,
    });

    processRun(result.runId).catch(() => {
      // Progress and errors reflected in run status
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Evaluation failed",
      },
      { status: 500 }
    );
  }
}
