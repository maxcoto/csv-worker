import type {
  CustomerRow,
  ExternalEventRow,
  OpportunityRow,
  TelemetryRow,
} from "./csv-ingest";
import { engineDb } from "./db/client";
import {
  customers,
  externalEvents,
  opportunities,
  telemetry,
} from "./db/schema";

/** Clear engine ingest tables and insert new data (for a fresh run). */
export async function storeIngest(data: {
  customerRows: CustomerRow[];
  opportunityRows: OpportunityRow[];
  externalEventRows: ExternalEventRow[];
  telemetryRows: TelemetryRow[];
}): Promise<void> {
  await engineDb.delete(externalEvents);
  await engineDb.delete(telemetry);
  await engineDb.delete(opportunities);
  await engineDb.delete(customers);

  if (data.customerRows.length > 0) {
    await engineDb.insert(customers).values(
      data.customerRows.map((r) => ({
        accountId: r.accountId,
        accountName: r.accountName,
        website: r.website,
        domain: r.domain,
        arr: r.arr,
        renewalDate: r.renewalDate,
        segment: r.segment,
        status: r.status,
        licensedSeats: r.licensedSeats,
        extra: r.extra as Record<string, unknown>,
      }))
    );
  }

  if (data.opportunityRows.length > 0) {
    await engineDb.insert(opportunities).values(
      data.opportunityRows.map((r) => ({
        accountId: r.accountId,
        opportunityId: r.opportunityId,
        type: r.type,
        stage: r.stage,
        createdDate: r.createdDate,
        closeDate: r.closeDate,
        amount: r.amount,
        extra: r.extra as Record<string, unknown>,
      }))
    );
  }

  if (data.externalEventRows.length > 0) {
    await engineDb.insert(externalEvents).values(
      data.externalEventRows.map((r) => ({
        domain: r.domain,
        eventType: r.eventType,
        eventTs: r.eventTs ? new Date(r.eventTs) : null,
        source: r.source,
        sourceUrl: r.sourceUrl,
        payloadJson: r.payloadJson,
        confidence: r.confidence,
        extra: r.extra as Record<string, unknown>,
      }))
    );
  }

  if (data.telemetryRows.length > 0) {
    await engineDb.insert(telemetry).values(
      data.telemetryRows.map((r) => ({
        domain: r.domain,
        month: r.month,
        activeUsers30d: r.activeUsers30d,
        licensedSeats: r.licensedSeats,
        featureAdoptionScore: r.featureAdoptionScore,
        extra: r.extra as Record<string, unknown>,
      }))
    );
  }
}
