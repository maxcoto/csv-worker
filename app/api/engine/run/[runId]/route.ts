import { NextResponse } from "next/server";
import { getExportRows } from "@/lib/engine/export-csv";
import { getRunProgress } from "@/lib/engine/run";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }
  try {
    const progress = await getRunProgress(runId);
    if (!progress) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    const results =
      progress.status === "completed" ? await getExportRows(runId) : [];
    return NextResponse.json({ ...progress, results });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get run",
      },
      { status: 500 }
    );
  }
}
