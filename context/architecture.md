# Architecture Context

## Platform
## Stack

| Layer          | Technology                                | Role                                                                 |
| -------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| Platform       | PWA (Progressive Web App)                  | Single codebase, installable on both phone and computer via the browser; works offline through a service worker (app shell) plus PowerSync (data) |
| Framework      | Next.js (App Router) + TypeScript          | UI rendering and API routes/server actions                            |
| UI             | Tailwind CSS v4 + shadcn/ui (Radix base, `radix-nova` style) | Component styling on top of the custom color/type tokens in `ui-context.md` |
| Auth           | Clerk                                      | Owner account (full credentials); worker devices unlock via a local PIN layered on top of a cached Clerk session |
| Database       | Prisma + PostgreSQL                        | Central source of truth — server-side only, never queried directly from the client |
| Offline sync   | PowerSync                                  | Replicates Postgres to on-device SQLite; enables offline reads/writes from the PWA |

| Icons          | Lucide React        | Matches the shadcn/ui convention                                       |

## System Boundaries

- `app/` — routed pages: the owner dashboard, each module's home
  screen, entry screens, and the shop's POS screen
- `components/ui/` — shadcn-generated primitives (protected — see
  `code-standards.md`)
- `components/farm/` — custom composed components shared across
  modules (metric cards, the "needs attention" list, quantity
  steppers, etc.)
- `lib/utils.ts` — the `cn()` class-merging helper, re-exported from the
  `cn` package (shadcn's drop-in replacement for `clsx` +
  `tailwind-merge`)
- `lib/db/` — Prisma client instance and query functions, server-only
- `lib/sync/` — PowerSync client setup and sync rule configuration
- `lib/auth/` — Clerk configuration and the PIN-unlock layer that
  switches between already-authenticated worker profiles on a shared
  device
- `prisma/schema.prisma` — the single central schema (see the
  accompanying `schema.prisma` file)

## Storage Model

- **Database (PostgreSQL via Prisma)**: all structured records —
  animals, milk records, health/breeding records, fields, crop
  cycles, input/harvest records, stock items, stock adjustments,
  sales, sale items, and users. This is the system of record.
- **On-device (SQLite via PowerSync)**: a synced mirror of the same
  tables. Writes land here first and are pushed to Postgres in the
  background; reads come from here so the app works with no
  connection.
- **Object/blob storage**: photos only (animal photos, product
  images). Postgres stores just the URL.

## Auth and Access Model

- The owner signs in via Clerk with full credentials; the session
  persists offline once established.
- Workers use a short PIN to switch identity on a device that has
  already authenticated with Clerk at least once online — the PIN is
  a fast local switch, not a replacement for Clerk's session security.
- Every record carries the id of the user who created it
  (`enteredById` / `recordedById` in the schema).
- A worker can edit only their own recent entries; the owner has full
  read/edit access across everything, including costs and profit.
- Revoking a worker's access takes effect immediately once online, but
  any device that hasn't reconnected since the revocation will still
  accept that worker's old PIN until it next syncs — a known,
  accepted gap given the offline-first design.

## Invariants

1. Milk is recorded as a single herd total per date and session
   (never per animal) — enforced by a `@@unique([date, session])`
   constraint on `MilkRecord`.
2. Workers never receive cost, price, or profit data in any API
   response — enforced server-side (in the query/response layer), not
   only hidden in the UI.
3. The Shop module has no automatic data dependency on Cows & Milk or
   Land & Produce — no code path may read milk or harvest records to
   affect shop stock. Restocking the shop is always a manual, explicit
   action.
4. Stock quantity must never go negative. A conflicting offline sale
   that would push a `StockItem` below zero is flagged for owner
   review at sync time rather than silently applied.
5. All Prisma/Postgres writes happen only on the server (route
   handlers or server actions). The client never talks to Postgres
   directly — on-device writes go through the local SQLite/PowerSync
   layer first and sync up afterward.
