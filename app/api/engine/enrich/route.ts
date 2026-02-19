import { eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { engineDb } from "@/lib/engine/db/client";
import { customers } from "@/lib/engine/db/schema";
import {
  createEnrichmentRun,
  runEnrichmentInBackground,
} from "@/lib/engine/run";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      domain?: string;
      eventPromptId?: string | null;
    };
    const domain = body.domain?.trim();
    const eventPromptId = body.eventPromptId ?? null;
    if (!domain) {
      return NextResponse.json(
        { error: "domain is required" },
        { status: 400 }
      );
    }
    const [exists] = await engineDb
      .select({ domain: customers.domain })
      .from(customers)
      .where(eq(customers.domain, domain))
      .limit(1);
    if (!exists) {
      return NextResponse.json(
        { error: "Customer not found for domain" },
        { status: 404 }
      );
    }
    const { runId } = await createEnrichmentRun(domain, eventPromptId);
    after(() => runEnrichmentInBackground(runId, domain, eventPromptId));
    return NextResponse.json({ runId, ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Enrichment failed",
      },
      { status: 500 }
    );
  }
}
