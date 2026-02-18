import { NextResponse } from "next/server";
import { getRunLogEntries } from "@/lib/engine/run-log";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }
  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get("since");
  const limitParam = searchParams.get("limit");
  const tailParam = searchParams.get("tail");

  try {
    if (tailParam !== null && tailParam !== "") {
      const tail = Math.min(500, Math.max(1, Number.parseInt(tailParam, 10)));
      if (Number.isNaN(tail)) {
        return NextResponse.json(
          { error: "tail must be a number" },
          { status: 400 }
        );
      }
      const { entries, hasMore } = await getRunLogEntries(runId, { tail });
      return NextResponse.json({ runId, entries, hasMore });
    }

    const since =
      sinceParam !== null && sinceParam !== ""
        ? Number.parseInt(sinceParam, 10)
        : 0;
    const limit = Math.min(
      500,
      Math.max(1, limitParam ? Number.parseInt(limitParam, 10) : 500)
    );
    if (Number.isNaN(since) || Number.isNaN(limit)) {
      return NextResponse.json(
        { error: "since and limit must be numbers" },
        { status: 400 }
      );
    }
    const { entries, hasMore } = await getRunLogEntries(runId, {
      since,
      limit,
    });
    return NextResponse.json({ runId, entries, hasMore });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get run log",
      },
      { status: 500 }
    );
  }
}
