# Farm & Shop Manager

A home-scale management app for a small operation with three independent
business lines: **dairy cattle** (herd registry and milk production), **crop
land** (fields, crop cycles and harvests), and a **standalone retail shop**.

It's used by the owner and a handful of farm workers, on both phone and
computer, and is built to keep working with no internet connection — entries
save to the device immediately and sync once it reconnects.

## Status

Early development. The design system and UI primitives are in place; data,
auth, and the three modules are not built yet. See
[`context/progress-tracker.md`](context/progress-tracker.md) for where things
actually stand.

## Stack

| Layer        | Technology                                  |
| ------------ | ------------------------------------------- |
| Platform     | PWA — installable on phone and desktop      |
| Framework    | Next.js 16 (App Router) + React 19 + TypeScript |
| UI           | Tailwind CSS v4 + shadcn/ui + Lucide icons  |
| Auth         | Clerk, with a local PIN layer for workers   |
| Database     | Prisma + PostgreSQL (server-side only)      |
| Offline sync | PowerSync — Postgres replicated to on-device SQLite |

## Getting started

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

```bash
npm run build   # production build
npm run lint    # eslint
```

## Project layout

```
app/              routed pages and layouts
components/ui/    shadcn-generated primitives — do not hand-edit
components/farm/  composed components shared across modules
lib/              db (Prisma), sync (PowerSync), auth (Clerk + PIN), utils
prisma/           the central schema
context/          product, architecture, UI and workflow specs
```

## Contributing

This project is spec-driven. Before changing anything, read the files in
[`context/`](context/) in the order listed in [`AGENTS.md`](AGENTS.md) — they
define the product, the architecture and its invariants, the visual language,
and the coding standards. Implement against those specs rather than inferring
behaviour, and update them when an implementation decision changes what they
describe.

Two rules worth calling out early:

- **`components/ui/*` is generated and protected.** Add primitives with the
  shadcn CLI; theme them by remapping tokens in `app/globals.css`, never by
  editing the generated files.
- **Workers must never receive cost, price, or profit data.** That's enforced
  server-side in the query and response layer, not just hidden in the UI.
