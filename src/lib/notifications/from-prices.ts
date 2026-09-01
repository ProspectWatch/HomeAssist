/**
 * Turning observed prices into the notifications the Notifications screen has
 * always been able to display and never had any.
 *
 * The screen, the table, the kinds and the colour coding were all built. No
 * code path anywhere ever inserted a row, so it has shown "nothing here" since
 * the day it shipped and always would have. The data to fill it already
 * exists: watched items carry a target price, and scans write observations.
 *
 * Two rules, both deliberately conservative:
 *
 *   A target is hit when an observed price is at or below it. That is a fact
 *   about two numbers, not a judgement.
 *
 *   Nothing is said twice. One unread notification per watched item is the
 *   limit — an app that reports the same $4.99 every night trains you to
 *   ignore it, and then it is worth nothing on the night it matters.
 */

export type WatchedPrice = {
  watchItemId: string;
  title: string;
  targetCents: number | null;
  observedCents: number | null;
  retailerName: string | null;
};

export type PendingNotification = {
  kind: "target_price_hit" | "regular_buy_deal";
  title: string;
  body: string;
  watchItemId: string | null;
};

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * @param existingUnread watch_item_ids that already have an unread notification.
 */
export function buildTargetHitNotifications(
  watched: WatchedPrice[],
  existingUnread: Set<string>,
): PendingNotification[] {
  const out: PendingNotification[] = [];
  for (const item of watched) {
    if (item.targetCents === null || item.observedCents === null) continue;
    if (item.observedCents > item.targetCents) continue;
    if (existingUnread.has(item.watchItemId)) continue;
    out.push({
      kind: "target_price_hit",
      title: item.title,
      body: item.retailerName
        ? `${money(item.observedCents)} at ${item.retailerName} — your target was ${money(item.targetCents)}.`
        : `${money(item.observedCents)} — your target was ${money(item.targetCents)}.`,
      watchItemId: item.watchItemId,
    });
  }
  return out;
}

export type RegularBuyDeal = {
  catalogProductId: string;
  title: string;
  priceCents: number;
  retailerName: string | null;
  /** The best price this household has previously seen, if any. */
  previousBestCents: number | null;
};

/**
 * A regular buy is worth mentioning when it is on offer below the best price
 * this household has ever recorded for it — not merely because it appeared in
 * a flyer. "Cheaper than you have ever paid" is a reason to buy two; "is in a
 * flyer" is not, and a notification for every flyer line is noise.
 */
export function buildRegularBuyNotifications(
  deals: RegularBuyDeal[],
  alreadyMentioned: Set<string>,
): PendingNotification[] {
  const out: PendingNotification[] = [];
  for (const deal of deals) {
    if (deal.previousBestCents === null) continue;
    if (deal.priceCents >= deal.previousBestCents) continue;
    if (alreadyMentioned.has(deal.catalogProductId)) continue;
    out.push({
      kind: "regular_buy_deal",
      title: deal.title,
      body: deal.retailerName
        ? `${money(deal.priceCents)} at ${deal.retailerName} — cheapest you've seen (was ${money(deal.previousBestCents)}).`
        : `${money(deal.priceCents)} — cheapest you've seen (was ${money(deal.previousBestCents)}).`,
      watchItemId: null,
    });
  }
  return out;
}
