/**
 * Reads a hand-typed price into cents.
 *
 * Always interpreted as dollars: a typed "549" is $5.49 to nobody, so it
 * becomes 54900 cents rather than being quietly re-read as $5.49. A wrong
 * number that looks plausible is worse than no number, so anything that
 * isn't a positive amount returns null and the caller shows nothing.
 */
export function parsePriceInput(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned === ".") return null;
  if (!/^\d*\.?\d*$/.test(cleaned)) return null;
  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars) || dollars <= 0) return null;
  return Math.round(dollars * 100);
}
