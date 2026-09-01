import { createClient } from "@/lib/supabase/server";
import { getHouseholdPeople } from "@/lib/data/people";
import type { HouseholdPerson } from "@/lib/household/people";
import type { Occasion, WishItem, WishOffer } from "@/lib/wish/model";

export type { Occasion, WishItem, WishOffer } from "@/lib/wish/model";
export { OCCASIONS, OCCASION_LABEL, PRIORITY_LABEL } from "@/lib/wish/model";

export type WishList = {
  person: HouseholdPerson | null;
  items: WishItem[];
};

type ItemRow = {
  id: string;
  title: string;
  notes: string | null;
  occasion: Occasion;
  status: "WANTED" | "GOT_IT";
  priority: number;
  image_url: string | null;
  person_id: string | null;
  created_at: string;
};

/**
 * Every wish list in the household, one per person plus a shared one.
 *
 * Grouped rather than flat because whose list a thing is on is the first
 * question anyone asks of it — a mixed list of everyone's wishes is not
 * something you can shop from.
 */
export async function getWishLists(householdId: string | null): Promise<WishList[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const [{ data: itemRows }, { data: offerRows }, people] = await Promise.all([
      supabase
        .from("wish_list_items")
        .select("id, title, notes, occasion, status, priority, image_url, person_id, created_at")
        .eq("household_id", householdId)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("wish_list_offers")
        .select("id, item_id, url, site_name, price_cents, currency, checked_at")
        .eq("household_id", householdId),
      getHouseholdPeople(householdId),
    ]);

    const offersByItem = new Map<string, WishOffer[]>();
    for (const row of (offerRows ?? []) as {
      id: string;
      item_id: string;
      url: string;
      site_name: string | null;
      price_cents: number | null;
      currency: string | null;
      checked_at: string;
    }[]) {
      const offer: WishOffer = {
        id: row.id,
        url: row.url,
        siteName: row.site_name,
        priceCents: row.price_cents,
        currency: row.currency,
        checkedAt: row.checked_at,
      };
      const bucket = offersByItem.get(row.item_id);
      if (bucket) bucket.push(offer);
      else offersByItem.set(row.item_id, [offer]);
    }

    const items: WishItem[] = ((itemRows ?? []) as ItemRow[]).map((row) => {
      const offers = (offersByItem.get(row.id) ?? []).sort(
        (a, b) => (a.priceCents ?? Infinity) - (b.priceCents ?? Infinity),
      );
      return {
        id: row.id,
        title: row.title,
        notes: row.notes,
        occasion: row.occasion,
        status: row.status,
        priority: row.priority,
        imageUrl: row.image_url,
        personId: row.person_id,
        offers,
        // Only an offer that actually carries a price can be the cheapest.
        // A shop whose page gave up no price is not evidence of anything.
        bestOffer: offers.find((o) => o.priceCents !== null) ?? null,
      };
    });

    const lists: WishList[] = people.map((person) => ({
      person,
      items: items.filter((i) => i.personId === person.id),
    }));
    const shared = items.filter((i) => i.personId === null);
    if (shared.length > 0) lists.push({ person: null, items: shared });
    return lists;
  } catch {
    return [];
  }
}
