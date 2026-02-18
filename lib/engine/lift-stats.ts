import { and, eq } from "drizzle-orm";
import { ALL_SIGNAL_TYPES } from "./atomic-signals";
import { engineDb } from "./db/client";
import {
  atomicSignals,
  customers,
  liftStats,
  opportunities,
} from "./db/schema";

export const LIFT_STATS_VERSION = "v1.0";

/** Expansion = Closed Won + type = Expansion; 90 days prior to close_date. */
export async function computeLiftStats(): Promise<void> {
  const expansionOpps = await engineDb
    .select({
      accountId: opportunities.accountId,
      closeDate: opportunities.closeDate,
    })
    .from(opportunities)
    .where(
      and(
        eq(opportunities.stage, "Closed Won"),
        eq(opportunities.type, "Expansion")
      )
    );

  const allCustomers = await engineDb
    .select({ accountId: customers.accountId, domain: customers.domain })
    .from(customers);
  const accountToDomain = new Map<string, string>();
  for (const c of allCustomers) {
    accountToDomain.set(c.accountId, c.domain);
  }

  const signalsByDomainMonth = await engineDb
    .select()
    .from(atomicSignals)
    .where(eq(atomicSignals.signalVersion, "v1.0"));

  const closedWonNonExpansion = await engineDb
    .select({
      accountId: opportunities.accountId,
      closeDate: opportunities.closeDate,
    })
    .from(opportunities)
    .where(eq(opportunities.stage, "Closed Won"));
  const expansionSet = new Set(
    expansionOpps.map((o) => `${o.accountId}|${o.closeDate}`)
  );

  for (const signalType of ALL_SIGNAL_TYPES) {
    let expansionWithSignal = 0;
    let expansionWithoutSignal = 0;
    let nonExpansionWithSignal = 0;
    let nonExpansionWithoutSignal = 0;

    for (const opp of expansionOpps) {
      const domain = accountToDomain.get(opp.accountId);
      if (!domain || !opp.closeDate) {
        continue;
      }
      const closeDate = new Date(opp.closeDate);
      const windowStart = new Date(closeDate);
      windowStart.setDate(windowStart.getDate() - 90);
      const windowStartStr = windowStart.toISOString().slice(0, 10);
      const closeStr = closeDate.toISOString().slice(0, 10);

      const hadSignalInWindow = signalsByDomainMonth.some(
        (s) =>
          s.domain === domain &&
          s.signalType === signalType &&
          s.month >= windowStartStr &&
          s.month <= closeStr
      );
      if (hadSignalInWindow) {
        expansionWithSignal++;
      } else {
        expansionWithoutSignal++;
      }
    }

    for (const opp of closedWonNonExpansion) {
      if (expansionSet.has(`${opp.accountId}|${opp.closeDate}`)) {
        continue;
      }
      const domain = accountToDomain.get(opp.accountId);
      if (!domain || !opp.closeDate) {
        continue;
      }
      const closeDate = new Date(opp.closeDate);
      const windowStart = new Date(closeDate);
      windowStart.setDate(windowStart.getDate() - 90);
      const windowStartStr = windowStart.toISOString().slice(0, 10);
      const closeStr = closeDate.toISOString().slice(0, 10);
      const hadSignalInWindow = signalsByDomainMonth.some(
        (s) =>
          s.domain === domain &&
          s.signalType === signalType &&
          s.month >= windowStartStr &&
          s.month <= closeStr
      );
      if (hadSignalInWindow) {
        nonExpansionWithSignal++;
      } else {
        nonExpansionWithoutSignal++;
      }
    }

    const withSignalTotal = expansionWithSignal + nonExpansionWithSignal;
    const withoutSignalTotal =
      expansionWithoutSignal + nonExpansionWithoutSignal;
    const expansionRate =
      withSignalTotal > 0 ? expansionWithSignal / withSignalTotal : 0;
    const nonExpansionRate =
      withoutSignalTotal > 0 ? expansionWithoutSignal / withoutSignalTotal : 0;
    const liftRatio =
      nonExpansionRate > 0 ? expansionRate / nonExpansionRate : expansionRate;
    const sampleSize = withSignalTotal + withoutSignalTotal;

    await engineDb.insert(liftStats).values({
      signalType,
      expansionRate,
      nonExpansionRate,
      liftRatio,
      sampleSize,
      liftStatsVersion: LIFT_STATS_VERSION,
    });
  }
}
