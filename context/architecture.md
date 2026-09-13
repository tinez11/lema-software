# Architecture Context

## Platform
## Stack

| Layer          | Technology                                | Role                                                                 |
| -------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| Platform       | PWA (Progressive Web App)                  | Single codebase, installable on both phone and computer via the browser; works offline through a service worker (app shell) plus PowerSync (data) |
| Framework      | Next.js (App Router) + TypeScript          | UI rendering and API routes/server actions                            |
| UI             | Tailwind CSS v4 + shadcn/ui (Radix base, `radix-nova` style) | Component styling on top of the custom color/type tokens in `ui-context.md` |
| Auth           | Clerk                                      | Owner account (full credentials); worker devices unlock via a local PIN layered on top of a cached Clerk session |
| Database       | Prisma 7 + PostgreSQL (`@prisma/adapter-pg` driver adapter) | Central source of truth — server-side only, never queried directly from the client |
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
- `lib/db/` — Prisma client instance (`client.ts`) and per-module query
  functions (`animals.ts`, `milk.ts`, `land.ts`, `shop.ts`), server-only.
  Every file in here starts with `import "server-only"`, so importing one
  from a client component is a build error rather than a runtime leak.
- `lib/sync/` — PowerSync client setup and sync rule configuration
- `lib/auth/` — Clerk configuration and the PIN-unlock layer that
  switches between already-authenticated worker profiles on a shared
  device:
  - `pin-config.ts` — PIN length, attempt limit, lockout seconds, and
    format check. The only file here without `server-only`, because the
    lock screen is a client component and must enforce the same numbers
  - `pin.ts` — scrypt hashing and constant-time comparison, server-only
  - `unlock.ts` — the signed, session-scoped unlock cookie
  - `session.ts` — `resolveAuthGate()`, which turns a request into one of
    signed-out / no-record / revoked / needs-pin-setup / needs-unlock /
    ready
  - `actions.ts` — the three server actions of the PIN flow, each
    re-reading the caller's identity from Clerk rather than a client prop
- `proxy.ts` — `clerkMiddleware` at the project root. Next 16 renamed
  `middleware.ts` to `proxy.ts`; everything is protected except
  `/sign-in`, `/sign-up`, `/__clerk/*` and the Clerk webhook
- `app/(app)/` — the route group holding every real app screen. Its
  layout applies the auth gate once, so no page has to remember to
- `app/lock/`, `app/set-pin/` — outside that group on purpose: a locked
  worker has to be able to reach the screen the group redirected them to
- `app/api/webhooks/clerk/` — creates the Prisma `User` row on
  `user.created`, authenticated by Svix signature rather than a session
- `prisma/schema.prisma` — the single central schema (see the
  accompanying `schema.prisma` file)
- `prisma/migrations/` — generated migration history; applied with
  `prisma migrate dev` locally and `prisma migrate deploy` elsewhere
- `prisma.config.ts` — Prisma 7 CLI config. Prisma 7 no longer accepts a
  `url` in the datasource block and no longer loads `.env` by itself, so
  this file loads `dotenv` and hands `DATABASE_URL` to migrate and
  introspect. The runtime client gets the same URL through its driver
  adapter instead.

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
- **The PIN check is central, not on-device.** The original plan was to
  sync `pinHash` down and compare it on the device via PowerSync. That
  was dropped: shipping a hash of a 4-digit secret to every shared
  device makes it brute-forceable offline, and a locally held attempt
  counter is reset by clearing app data. Keeping the hash in Postgres
  costs a network round-trip to unlock, so a worker who is fully offline
  and has not unlocked yet this session sees an explicit offline message
  rather than a silent failure. Work already entered is unaffected — it
  is queued locally and syncs later.
- **A forgotten PIN is reset by the owner, never by the worker.** Anyone
  sitting at a locked screen already holds a cached Clerk session on
  that device — precisely the case the PIN exists to stop — so a
  self-serve reset would hand the app to whoever picked the phone up.
  The owner clears it from their home screen
  (`resetWorkerPinAction`, owner-only, server-checked), which also
  clears any lockout; the worker then chooses a new PIN on their next
  open. This matches how invites and revocation already work.
- The unlock itself is a signed, `httpOnly` session cookie naming the
  user it was issued for. It has no `maxAge`, so closing the app clears
  it; foregrounding clears it explicitly from the client. It carries no
  authority of its own — Clerk's session is still what authenticates
  every request.

## Invariants

1. Milk is recorded as a single herd total per date and session
   (never per animal) — enforced by a `@@unique([date, session])`
   constraint on `MilkRecord`.
2. Workers never receive cost, price, or profit data in any API
   response. This is enforced inside `lib/db/` itself, not by a
   filtering layer above it: every module exposes a default read
   helper that never selects financial columns, and a separately
   named `...WithPricing()` / `...WithFinancials()` variant for the
   financial fields, callable only from code paths that have already
   verified `role === OWNER`. A helper must never accept a role
   parameter and branch internally — the safe and privileged paths
   stay two distinct, greppable exports.
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
6. `User.pinHash` never leaves the server and is never synced to a
   device. Only `verifyPinHash()` in `lib/db/users.ts` reads the column,
   and it returns a verdict rather than the hash; every other read of
   `User` uses a select that omits it. A PIN is therefore checked with a
   network round-trip, by design — see the PowerSync note below.
7. A worker's PIN state is server-authoritative. Attempt count and
   lockout expiry live on the `User` row, so clearing app data,
   reinstalling, or moving to another device does not hand back a fresh
   set of attempts.
