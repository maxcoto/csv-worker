import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { engineDb } from "@/lib/engine/db/client";
import { runs } from "@/lib/engine/db/schema";
import { getExportRows, toCsv } from "@/lib/engine/export-csv";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }
  try {
    const [run] = await engineDb
      .select({ evaluationMonth: runs.evaluationMonth })
      .from(runs)
      .where(eq(runs.id, runId));
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    const rows = await getExportRows(runId);
    const csv = toCsv(rows);
    const month = String(run.evaluationMonth).slice(0, 10);
    const filename = `expansion_signal_report_${month}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Export failed",
      },
      { status: 500 }
    );
  }
}
