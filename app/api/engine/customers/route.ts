import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { engineDb } from "@/lib/engine/db/client";
import { customers } from "@/lib/engine/db/schema";

export async function GET() {
  try {
    const rows = await engineDb
      .select({
        domain: customers.domain,
        accountName: customers.accountName,
        lastEnrichedAt: customers.lastEnrichedAt,
        lastEnrichmentRunId: customers.lastEnrichmentRunId,
      })
      .from(customers)
      .orderBy(asc(customers.domain));
    const list = rows.map((r) => ({
      domain: r.domain,
      account_name: r.accountName ?? "",
      last_enriched_at: r.lastEnrichedAt?.toISOString() ?? null,
      last_enrichment_run_id: r.lastEnrichmentRunId ?? null,
    }));
    return NextResponse.json({ customers: list });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list customers",
      },
      { status: 500 }
    );
  }
}
