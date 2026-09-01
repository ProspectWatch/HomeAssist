/**
 * Wish-list vocabulary and shapes.
 *
 * Kept apart from the data layer because the screen is a client component and
 * needs these constants: importing them from a module that also reaches for
 * the server Supabase client drags `next/headers` into the browser bundle and
 * the build refuses it, correctly.
 */

export const OCCASIONS = ["BIRTHDAY", "CHRISTMAS", "SAVING_UP", "ANYTIME"] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const OCCASION_LABEL: Record<Occasion, string> = {
  BIRTHDAY: "Birthday",
  CHRISTMAS: "Christmas",
  SAVING_UP: "Saving up",
  ANYTIME: "Anytime",
};

export const PRIORITY_LABEL: Record<number, string> = {
  3: "Really wants",
  2: "Would like",
  1: "Just noted",
};

export type WishOffer = {
  id: string;
  url: string;
  siteName: string | null;
  priceCents: number | null;
  currency: string | null;
  checkedAt: string;
};

export type WishItem = {
  id: string;
  title: string;
  notes: string | null;
  occasion: Occasion;
  status: "WANTED" | "GOT_IT";
  priority: number;
  imageUrl: string | null;
  personId: string | null;
  offers: WishOffer[];
  /** The cheapest offer that actually has a price, or null when none does. */
  bestOffer: WishOffer | null;
};
