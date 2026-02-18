import { NextResponse } from "next/server";
import {
  parseCustomersCsv,
  parseExternalEventsCsv,
  parseOpportunitiesCsv,
  parseTelemetryCsv,
} from "@/lib/engine/csv-ingest";
import { storeIngest } from "@/lib/engine/ingest-store";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      opportunitiesCsv?: string;
      externalEventsCsv?: string;
      customersCsv?: string;
      telemetryCsv?: string;
    };
    const customersCsv = body.customersCsv ?? "";
    const opportunitiesCsv = body.opportunitiesCsv ?? "";
    const externalEventsCsv = body.externalEventsCsv ?? "";
    const telemetryCsv = body.telemetryCsv ?? "";

    const customerRows = parseCustomersCsv(customersCsv);
    const opportunityRows = parseOpportunitiesCsv(opportunitiesCsv);
    const externalEventRows = parseExternalEventsCsv(externalEventsCsv);
    const telemetryRows = parseTelemetryCsv(telemetryCsv);

    await storeIngest({
      customerRows,
      opportunityRows,
      externalEventRows,
      telemetryRows,
    });

    return NextResponse.json({
      ok: true,
      customers: customerRows.length,
      opportunities: opportunityRows.length,
      externalEvents: externalEventRows.length,
      telemetry: telemetryRows.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Ingest failed",
      },
      { status: 500 }
    );
  }
}
