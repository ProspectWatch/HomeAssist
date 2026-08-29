# Design system — starting point

**No Claude Design screens have been supplied to this repository yet.**
The tokens and components below are a clean, neutral placeholder so the
navigation shell has a real system to sit on rather than default
`create-next-app` styling. They are explicitly *not* the visual source of
truth — once the approved Claude Design screens are provided, this file
and `src/app/globals.css` are what should change first.

## Tokens (`src/app/globals.css`, Tailwind v4 `@theme`)

- **Color** — `brand-*` (primary), `accent-*` (deals/savings highlights),
  `surface-*` (neutral scale for backgrounds/text/borders), plus
  `success` / `danger` / `warning`. All defined as OKLCH so hue/lightness
  can be re-tuned without recomputing hex values by hand.
- **Radius** — `--radius-sm/md/lg/xl`, used via Tailwind's arbitrary
  property syntax (`rounded-(--radius-lg)`) so every rounded corner in the
  app traces back to one of four values.
- **Type** — system font stack via `next/font` (Geist); no custom type
  scale defined yet beyond Tailwind's defaults.

## Components (`src/components/ui`)

`Button`, `Card` (+ Header/Title/Description/Content/Footer), `Badge`,
`Input`, `EmptyState`. Each consumes tokens rather than hardcoded values,
and takes a `className` for one-off overrides via `cn()`
(`clsx` + `tailwind-merge`).

## Navigation (`src/components/nav`)

- `BottomNav` — fixed, 5-tab bar (Home / Shop / Watch / Rooms / More) per
  the approved navigation shell. Active tab highlighted via `brand-600`;
  respects `env(safe-area-inset-bottom)` for iOS home-indicator spacing.
- `TopBar` — per-page header (title + optional subtitle), respects
  `env(safe-area-inset-top)`.

## Replacing this with the approved design

1. Re-derive the token values in `globals.css` from the Claude Design
   screens (colors, radii, spacing, type).
2. Adjust `src/components/ui/*` to match the approved component styling —
   the props/variants (`primary`/`secondary`/..., `sm`/`md`/`lg`) can stay
   if they still make sense; only the visual treatment should change.
3. Rebuild each page under `src/app/(shell)/*` against the approved
   screens. The empty states currently in Home/Shop/Watch/Rooms are
   intentional (no fabricated products/prices) and should stay empty
   states unless the design calls for something else.
