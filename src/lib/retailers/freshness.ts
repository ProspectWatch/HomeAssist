/**
 * How long a grocery price stays trustworthy.
 *
 * Grocery pricing moves weekly, so an observation is not wrong after a few
 * days — it is just no longer something to state as current without saying
 * when it was seen. The UI must qualify anything past FRESH.
 */
export type Freshness = "FRESH" | "AGING" | "STALE";

export const FRESHNESS_POLICY = {
  /** Within this window a price may be shown plainly as the current price. */
  freshHours: 24,
  /** Past this, the price is stale and must be labelled as such. */
  staleHours: 24 * 7,
} as const;

export function classifyFreshness(observedAt: string | Date, now: Date = new Date()): Freshness {
  const observed = observedAt instanceof Date ? observedAt : new Date(observedAt);
  if (Number.isNaN(observed.getTime())) return "STALE";
  const hours = (now.getTime() - observed.getTime()) / 36e5;
  if (hours < 0) return "FRESH"; // clock skew — treat as just-observed
  if (hours <= FRESHNESS_POLICY.freshHours) return "FRESH";
  if (hours <= FRESHNESS_POLICY.staleHours) return "AGING";
  return "STALE";
}

/** "Today 4:12 PM" / "Yesterday 9:03 AM" / "Aug 24, 4:12 PM". */
export function formatLastChecked(observedAt: string | Date, now: Date = new Date()): string {
  const observed = observedAt instanceof Date ? observedAt : new Date(observedAt);
  if (Number.isNaN(observed.getTime())) return "Never";

  const time = observed.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
  const sameDay = observed.toDateString() === now.toDateString();
  if (sameDay) return `Today ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (observed.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;

  return `${observed.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}, ${time}`;
}

/** Qualifier the UI appends so a stale price is never presented as current. */
export function freshnessLabel(freshness: Freshness): string | null {
  switch (freshness) {
    case "FRESH":
      return null;
    case "AGING":
      return "Price may have changed";
    case "STALE":
      return "Stale — needs a re-check";
  }
}
