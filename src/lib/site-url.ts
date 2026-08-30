// Canonical origin for building auth redirect URLs (magic-link emailRedirectTo,
// the /auth/callback landing redirect). Never trust a client-supplied origin
// (e.g. window.location.origin) for this — someone testing from a local dev
// server against the shared production Supabase project would otherwise send
// production users' magic links to localhost.
const PRODUCTION_SITE_URL = "https://homeassist-flame.vercel.app";

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    return PRODUCTION_SITE_URL;
  }

  return "http://localhost:3000";
}
