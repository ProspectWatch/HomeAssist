export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}
