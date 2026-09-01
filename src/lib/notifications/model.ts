/**
 * Notification vocabulary and shape.
 *
 * Separate from the data layer for the same reason the wish-list model is: the
 * Notifications screen is a client component and needs the labels and colours,
 * and importing them from a module that also builds the server Supabase client
 * drags `next/headers` into the browser bundle, which the build refuses.
 */

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
};

const DOT_COLOR: Record<string, string> = {
  target_price_hit: "#3F7A55",
  price_drop: "#6E8291",
  restock: "#4C8A63",
  regular_buy_deal: "#B8946A",
};

export function notificationDotColor(kind: string): string {
  return DOT_COLOR[kind] ?? "#9C9166";
}

const KIND_LABEL: Record<string, string> = {
  target_price_hit: "Target Price Hit",
  price_drop: "Price Drop",
  restock: "Back in Stock",
  regular_buy_deal: "Regular Buy",
};

export function notificationKindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}
