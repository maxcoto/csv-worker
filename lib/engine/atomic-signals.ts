import { and, eq } from "drizzle-orm";
import { engineDb } from "./db/client";
import { atomicSignals, externalEvents, telemetry } from "./db/schema";

export const SIGNAL_VERSION = "v1.0";

export const EXPANSION_SIGNAL_TYPES = [
  "seat_saturation",
  "adoption_acceleration",
  "feature_adoption_high",
] as const;

/** Risk signals aligned with Expansion Evaluation taxonomy: Negative usage trends, Executive departures or layoffs. */
export const RISK_SIGNAL_TYPES = [
  "usage_decline",
  "layoff_event_recent",
  "exec_departure_ld_recent",
] as const;

export const ALL_SIGNAL_TYPES = [
  ...EXPANSION_SIGNAL_TYPES,
  ...RISK_SIGNAL_TYPES,
] as const;

export type SignalType = (typeof ALL_SIGNAL_TYPES)[number];

/** Compute and persist atomic signals for given domains and evaluation month. */
export async function computeAtomicSignals(
  domains: string[],
  evaluationMonth: string
): Promise<void> {
  const monthDate = new Date(evaluationMonth);

  for (const domain of domains) {
    const [telRow, events] = await Promise.all([
      engineDb
        .select()
        .from(telemetry)
        .where(
          and(
            eq(telemetry.domain, domain),
            eq(telemetry.month, evaluationMonth)
          )
        )
        .limit(1)
        .then((rows) => rows[0]),
      engineDb
        .select()
        .from(externalEvents)
        .where(eq(externalEvents.domain, domain)),
    ]);

    const tel = telRow ?? null;

    const activeUsers = tel?.activeUsers30d ?? 0;
    const licensedSeats = tel?.licensedSeats ?? 0;
    const adoption = tel?.featureAdoptionScore ?? 0;

    // Seat saturation: active_users / licensed_seats (cap 1); score 0-100
    const seatSaturation =
      licensedSeats > 0 ? Math.min(1, activeUsers / licensedSeats) : 0;
    const seatSaturationScore = Math.round(seatSaturation * 100);

    // Adoption acceleration: compare to previous month if we had it (simplified: use level)
    const adoptionAcceleration =
      adoption >= 0.8 ? 1 : adoption >= 0.5 ? 0.5 : 0;
    const adoptionAccelerationScore = Math.round(adoptionAcceleration * 100);

    // Feature adoption high: threshold >= 0.8
    const featureAdoptionHigh = adoption >= 0.8 ? 1 : 0;
    const featureAdoptionHighScore = adoption >= 0.8 ? 100 : 0;

    // Usage decline: active < 50% of seats
    const usageDecline =
      licensedSeats > 0 && activeUsers / licensedSeats < 0.5 ? 1 : 0;
    const usageDeclineScore = usageDecline * 100;

    const ninetyDaysAgo = new Date(monthDate);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().slice(0, 10);

    const recentEvents = events.filter((e) => {
      const ts = e.eventTs
        ? new Date(e.eventTs).toISOString().slice(0, 10)
        : "";
      return ts >= ninetyDaysAgoStr && ts <= evaluationMonth;
    });

    const layoffRecent = recentEvents.some((e) => {
      const t = (e.eventType ?? "").toLowerCase();
      return t === "layoff" || t.includes("layoff") || t.includes("redundancy");
    });
    const execDepartureRecent = recentEvents.some((e) => {
      const t = (e.eventType ?? "").toLowerCase();
      return (
        t === "exec_departure_ld" ||
        t.includes("exec") ||
        t.includes("departure") ||
        t.includes("ld")
      );
    });

    const toInsert: Array<{
      domain: string;
      month: string;
      signalType: string;
      signalValue: number;
      signalScore: number;
      signalTimestamp: Date;
      signalVersion: string;
    }> = [
      {
        domain,
        month: evaluationMonth,
        signalType: "seat_saturation",
        signalValue: seatSaturation,
        signalScore: seatSaturationScore,
        signalTimestamp: new Date(evaluationMonth),
        signalVersion: SIGNAL_VERSION,
      },
      {
        domain,
        month: evaluationMonth,
        signalType: "adoption_acceleration",
        signalValue: adoptionAcceleration,
        signalScore: adoptionAccelerationScore,
        signalTimestamp: new Date(evaluationMonth),
        signalVersion: SIGNAL_VERSION,
      },
      {
        domain,
        month: evaluationMonth,
        signalType: "feature_adoption_high",
        signalValue: featureAdoptionHigh,
        signalScore: featureAdoptionHighScore,
        signalTimestamp: new Date(evaluationMonth),
        signalVersion: SIGNAL_VERSION,
      },
      {
        domain,
        month: evaluationMonth,
        signalType: "usage_decline",
        signalValue: usageDecline,
        signalScore: usageDeclineScore,
        signalTimestamp: new Date(evaluationMonth),
        signalVersion: SIGNAL_VERSION,
      },
      {
        domain,
        month: evaluationMonth,
        signalType: "layoff_event_recent",
        signalValue: layoffRecent ? 1 : 0,
        signalScore: layoffRecent ? 100 : 0,
        signalTimestamp: new Date(evaluationMonth),
        signalVersion: SIGNAL_VERSION,
      },
      {
        domain,
        month: evaluationMonth,
        signalType: "exec_departure_ld_recent",
        signalValue: execDepartureRecent ? 1 : 0,
        signalScore: execDepartureRecent ? 100 : 0,
        signalTimestamp: new Date(evaluationMonth),
        signalVersion: SIGNAL_VERSION,
      },
    ];

    for (const row of toInsert) {
      await engineDb
        .insert(atomicSignals)
        .values(row)
        .onConflictDoUpdate({
          target: [
            atomicSignals.domain,
            atomicSignals.month,
            atomicSignals.signalType,
          ],
          set: {
            signalValue: row.signalValue,
            signalScore: row.signalScore,
            signalTimestamp: row.signalTimestamp as Date,
          },
        });
    }
  }
}
