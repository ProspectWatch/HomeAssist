# Brown Family Home — Architecture

Status: **Phase 1 — navigation shell + household/rooms/watch-list foundation.**
Retailer scanning is intentionally not implemented. Everything below marked
"future" is designed for, not built.

## 1. Production stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router, React 19, TypeScript), Tailwind CSS v4 | Server Components for fast mobile loads, one codebase for the PWA, works with the "responsive web app first" decision instead of a native app store pipeline. |
| Delivery | Installable PWA (manifest + minimal service worker) | Home-screen installable on iOS/Android without app-store review; can be wrapped in Expo/Capacitor later if a native build is ever wanted — no rewrite needed. |
| Backend/DB | Supabase (Postgres, Auth, Storage, Edge Functions) | Postgres + Row Level Security gives household-scoped data isolation for free; Auth handles family member accounts; Storage handles product/room images; Edge Functions + pg_cron cover scheduled scanning without a separate server to operate. |
| Deployment | Vercel (frontend) + Supabase Cloud (backend) | Both have generous free/hobby tiers, git-integrated preview deploys, and no infrastructure to patch. |
| UI primitives | Hand-rolled components (`src/components/ui`) styled from CSS custom-property tokens, `class-variance-authority` for variants, `lucide-react` for icons | Keeps the design system a thin, swappable layer so the approved Claude Design screens (once supplied) can be dropped in by changing tokens/markup, not by fighting a heavier component library. |

## 2. Repository structure

Single Next.js app at the repo root (no monorepo/workspaces yet — there is
only one deployable today, so the extra tooling isn't earning its keep).

```
brown-family-home/
├─ src/
│  ├─ app/
│  │  ├─ (shell)/            # routes behind the bottom nav
│  │  │  ├─ home/page.tsx
│  │  │  ├─ shop/page.tsx
│  │  │  ├─ watch/page.tsx
│  │  │  ├─ rooms/page.tsx
│  │  │  ├─ more/page.tsx
│  │  │  └─ layout.tsx       # renders <BottomNav/> around the tabs
│  │  ├─ layout.tsx          # root layout: fonts, manifest, viewport
│  │  ├─ page.tsx            # redirects "/" -> "/home"
│  │  ├─ globals.css         # design tokens (Tailwind v4 @theme)
│  │  └─ sw-register.tsx
│  ├─ components/
│  │  ├─ nav/                # BottomNav, TopBar
│  │  └─ ui/                 # Button, Card, Badge, Input, EmptyState
│  ├─ lib/
│  │  ├─ supabase/           # browser + server Supabase clients
│  │  └─ utils.ts
│  ├─ types/database.ts      # placeholder for `supabase gen types`
│  └─ proxy.ts                # Next 16 middleware-equivalent: refreshes the Supabase session
├─ supabase/
│  ├─ migrations/            # SQL schema, applied with `supabase db push`
│  ├─ functions/             # Edge Functions (Deno)
│  └─ config.toml
├─ public/
│  ├─ manifest.webmanifest
│  ├─ sw.js
│  └─ icons/
└─ docs/ARCHITECTURE.md      # this file
```

As Phase 2+ adds real scanning workers, revisit whether those belong as more
Supabase Edge Functions (default) or a separate service — see §4.

## 3. Database / backend architecture

Postgres via Supabase, one project per environment (`dev`, `staging`,
`prod` — provisioned when we go live; not yet created). Every table below
lives in `supabase/migrations/0001_init.sql`.

- **`households` / `household_members`** — a household is the tenant
  boundary. All other tables key off `household_id` and are protected by
  Row Level Security via an `is_household_member()` helper, so one
  family's data is never visible to another even though every household
  shares the same database.
- **`rooms`** — household-scoped, freeform (Kitchen, Nursery, ...).
- **`retailers`** — reference data for retailers we might scan later.
  Empty until a retailer is explicitly onboarded; `scan_enabled` stays
  `false` until that retailer's scanner is actually built.
- **`products`** — a household's own catalog entries. Phase 1: added
  manually (paste a title/URL); nothing here comes from scraping.
- **`watch_items`** — the Watch tab: links a product to a household, an
  optional room, and an optional user-set `target_price_cents`. That target
  price is something *the user typed in* — never confused with an
  observed/historical price.
- **`price_snapshots`** — structure only. No seed data, no fabricated
  history. Rows only ever come from (a) the future scan pipeline or (b) a
  user manually logging a price they personally saw, tagged
  `source = 'manual'`.
- **`scan_jobs`** — bookkeeping for scheduled scan runs (see §4).
  Service-role only (no client policy), since only the scheduler writes to
  it.

Regenerate TypeScript types after any schema change:

```
npx supabase gen types typescript --project-id <project-ref> > src/types/database.ts
```

## 4. Scheduled product/deal scanning (design only — not built)

Goal: periodically re-check the price/availability of every actively
watched product, without building retailer scrapers yet.

Planned shape, once retailer scanning is scoped and approved:

1. **Trigger** — Supabase `pg_cron`, running on a schedule (e.g. hourly),
   calls a Postgres function that does an authenticated HTTP POST (via
   `pg_net`) to the `scan-scheduler` Edge Function. This is configured
   directly in the Supabase project (SQL editor / a dashboard-managed
   migration) rather than committed to git, since it embeds the project's
   function URL and a secret — both environment-specific.
2. **Dispatch** — `supabase/functions/scan-scheduler` (present today as a
   stub, see below) opens a `scan_jobs` row, and will eventually fan out
   one job per `retailers.scan_enabled = true` retailer that has at least
   one actively-watched product.
3. **Per-retailer scan** (future) — a dedicated Edge Function (or, if
   volume/rate-limits demand it, a small external worker) fetches current
   price/availability for each watched product at that retailer and
   inserts a `price_snapshots` row per result.
4. **Completion** — the `scan_jobs` row is updated with status,
   `products_scanned`, and any error, giving an audit trail and something
   the Watch tab can show ("last checked 12 minutes ago").

**What exists today:** `supabase/functions/scan-scheduler/index.ts` is a
stub that opens and closes a `scan_jobs` row with zero products scanned —
it proves the cron → function → DB path works end-to-end without touching
a single retailer. Building the actual per-retailer scanners is explicitly
out of scope until requested.

## 5. Image / asset storage

Supabase Storage, one bucket per concern:

- `product-images` — product photos. Public-read (product photos aren't
  sensitive), household-scoped write via a storage policy mirroring
  `is_household_member()`.
- `room-images` — user-uploaded room photos, same pattern.

Uploads go through the Supabase client SDK directly from the browser
(signed via RLS + the user's session — no custom upload API needed for
Phase 1). Next.js `<Image>` is configured against the project's Storage
CDN domain once the project exists. Buckets aren't created yet — that's a
one-time step against the live Supabase project, not something to encode
in a migration.

## 6. Deployment architecture

- **Frontend** — Vercel, connected to this repo. `main` deploys to
  production; every PR gets a preview deployment against the `dev`
  Supabase project (once provisioned) so nothing touches real household
  data pre-merge.
- **Backend** — Supabase Cloud. Schema changes go through
  `supabase/migrations` via `supabase db push` (or CI, once a project
  exists) — never hand-edited in the dashboard, so `main` always reflects
  the real schema.
- **Environments** — `dev` → Vercel preview + Supabase dev project,
  `prod` → Vercel production + Supabase prod project. `staging` can be
  added the same way if/when needed.
- **Secrets** — `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  as Vercel env vars (safe to expose, RLS is the real boundary);
  `SUPABASE_SERVICE_ROLE_KEY` and `SCAN_SCHEDULER_SECRET` only as Supabase
  Edge Function secrets — never in the frontend bundle, never committed
  (`.env.example` documents the shape, not the values).
- **CI** (`.github/workflows/ci.yml`) — typecheck, lint, and build on every
  push/PR, so a broken build never reaches a preview deploy.

None of the above cloud resources (Vercel project, Supabase project) are
provisioned yet — the app currently only exists as this repository. That's
a deliberate "scaffold now, provision later" choice so nothing billable
gets created without an explicit go-ahead.
