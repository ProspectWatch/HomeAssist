/**
 * Turning messy retailer strings into comparable values.
 *
 * Pure and dependency-free so every rule here is directly testable against
 * real retailer strings captured as fixtures.
 */

/** Lowercase, strip punctuation/accents, collapse whitespace. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Drop apostrophes rather than splitting on them, so "Earth's Own" and
    // "Marilu's" stay single tokens and still match the catalogue.
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9%.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words that carry no product identity and only add false overlap. */
const STOP_WORDS = new Set([
  "the", "a", "an", "of", "and", "with", "for", "in", "pack", "count", "ct",
  "size", "each", "ea", "fresh", "product", "brand", "new",
]);

export function tokenize(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/** "$5.99" / "5,99" / "599¢" -> cents. Null when there is no real number. */
export function parsePriceToCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    // Retailers expose dollars as a number; treat integers cautiously as dollars.
    return Math.round(value * 100);
  }
  const cleaned = value.replace(/[^0-9.,]/g, "").replace(/,(\d{2})$/, ".$1").replace(/,/g, "");
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

export type PackageSize = { quantity: number | null; unit: string | null; raw: string | null };

const UNIT_ALIASES: Record<string, string> = {
  g: "g", gr: "g", gram: "g", grams: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg",
  ml: "ml", millilitre: "ml", milliliter: "ml",
  l: "L", litre: "L", liter: "L", litres: "L", liters: "L",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  oz: "oz", ounce: "oz", ounces: "oz",
  ea: "ea", each: "ea",
};

/** "2 L", "500g", "4 x 100 mL", "1.36kg" -> a comparable quantity + unit. */
export function parsePackageSize(value: string | null | undefined): PackageSize {
  if (!value) return { quantity: null, unit: null, raw: null };
  const raw = value.trim();
  const normalized = raw.toLowerCase().replace(/,/g, ".");

  // Multi-packs: use the total (4 x 100 mL -> 400 mL).
  const multi = normalized.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*([a-z]+)/);
  if (multi) {
    const unit = UNIT_ALIASES[multi[3]] ?? null;
    return { quantity: Number(multi[1]) * Number(multi[2]), unit, raw };
  }

  const single = normalized.match(/(\d+(?:\.\d+)?)\s*([a-z]+)/);
  if (single) {
    const unit = UNIT_ALIASES[single[2]] ?? null;
    return { quantity: Number(single[1]), unit: unit, raw };
  }
  return { quantity: null, unit: null, raw };
}

/** Grams / millilitres, so 1.36 kg and 1360 g compare equal. */
export function toBaseUnits(size: PackageSize): { amount: number; base: "g" | "ml" | "ea" } | null {
  if (size.quantity === null || size.unit === null) return null;
  switch (size.unit) {
    case "g":
      return { amount: size.quantity, base: "g" };
    case "kg":
      return { amount: size.quantity * 1000, base: "g" };
    case "lb":
      return { amount: size.quantity * 453.592, base: "g" };
    case "oz":
      return { amount: size.quantity * 28.3495, base: "g" };
    case "ml":
      return { amount: size.quantity, base: "ml" };
    case "L":
      return { amount: size.quantity * 1000, base: "ml" };
    case "ea":
      return { amount: size.quantity, base: "ea" };
    default:
      return null;
  }
}

/** True when two package sizes are the same to within 5% (label rounding). */
export function packageSizesComparable(a: PackageSize, b: PackageSize): boolean {
  const ba = toBaseUnits(a);
  const bb = toBaseUnits(b);
  if (!ba || !bb || ba.base !== bb.base) return false;
  if (ba.amount === 0 || bb.amount === 0) return false;
  return Math.abs(ba.amount - bb.amount) / Math.max(ba.amount, bb.amount) <= 0.05;
}

/**
 * A promotion window. Returns nulls rather than guessing when the retailer
 * only gives one side of the range — a made-up end date would silently make
 * a stale price look current.
 */
export function parsePromotionWindow(
  start: string | null | undefined,
  end: string | null | undefined,
): { validFrom: string | null; validUntil: string | null } {
  const toIso = (v: string | null | undefined): string | null => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  };
  return { validFrom: toIso(start), validUntil: toIso(end) };
}
