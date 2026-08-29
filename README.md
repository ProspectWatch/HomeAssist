# Brown Family Home

A mobile-first PWA for the Brown family to shop, watch prices, and plan
rooms — one place for "what are we tracking, and what's it worth right
now."

**Status:** Phase 1 — navigation shell, household/room/watch-list
foundation. Retailer price scanning is not implemented yet; see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the plan.

## Stack

Next.js 16 (App Router, React 19, TypeScript) · Tailwind CSS v4 · Supabase
(Postgres, Auth, Storage, Edge Functions) · deployed on Vercel + Supabase
Cloud. Full rationale in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in a Supabase project's URL + anon key
npm run dev
```

Open <http://localhost:3000> — it redirects to `/home`.

## Database

Schema lives in `supabase/migrations/`. Against a Supabase project:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx tsc --noEmit` — typecheck

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, repo layout, DB
  schema, scheduled-scanning design, storage, deployment.
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — current design tokens
  and components, and how to swap in the approved Claude Design screens.
