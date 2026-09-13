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
  steppers, etc.), plus the module-specific screens composed from them.
  `quantity-stepper.tsx` is the genuinely shared one — a harvest weight
  and a stock count are the same control — while `session-toggle.tsx`,
  `milk-entry-form.tsx` and `milk-history-list.tsx` belong to Cows &
  Milk, the way `pin-pad.tsx` belongs to auth
- `lib/utils.ts` — the `cn()` class-merging helper, re-exported from the
  `cn` package (shadcn's drop-in replacement for `clsx` +
  `tailwind-merge`)
- `lib/db/` — Prisma client instance (`client.ts`) and per-module query
  functions (`animals.ts`, `milk.ts`, `land.ts`, `shop.ts`), server-only.
  Every file in here starts with `import "server-only"`, so importing one
  from a client component is a build error rather than a runtime leak.
- `lib/milk-config.ts` — the bounds of a herd-total entry (minimum,
  ceiling, stepper increment, decimal places) and the rounding both
  sides apply. Not `server-only`, for the same reason as
  `pin-config.ts`: the stepper is a client component and must offer
  exactly the range the server action accepts
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
  `/sign-in`, `/signed-out`, `/__clerk/*` and the Clerk webhook
- `app/signed-out/` — where Clerk lands the browser after sign-out. The
  unlock cookie is `httpOnly`, so only the server can drop it; without
  this stop the cookie would outlive the session and let the same worker
  back in on their next sign-in without a PIN
- `app/(app)/` — the route group holding every real app screen. Its
  layout applies the auth gate once, so no page underneath it has to
  apply the gate again. `app/(app)/page.tsx` routes on role: a worker
  lands on the milk entry screen itself, an owner on the Cows & Milk
  module home
- `app/(app)/milk/actions.ts` — the module's server actions. A module's
  writes live in an `actions.ts` beside its route rather than in
  `lib/db/`, because this is where the caller's identity is resolved
  (from Clerk, never from a prop) and its input validated with `zod`
  before a query helper is reached. The folder holds no `page.tsx`: the
  screens are reached through `/`, not `/milk`, until there is more than
  one module to switch between
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
- **Civil days, not timestamps.** `MilkRecord.date` is a Postgres
  `date` — no time, no zone — because invariant 1 makes (date, session)
  the identity of a record. Prisma reads one back as midnight UTC, so
  every date written has to be built the same way or "today" never
  compares equal to a stored date and the constraint guards the wrong
  thing. `farmDate()` in `lib/db/milk.ts` is that one conversion, and
  every screen formats those dates back with `timeZone: "UTC"`. Which
  civil day it is still comes from the *server's* clock — see open
  question 12.

## Auth and Access Model

- The owner signs in via Clerk with full credentials; the session
  persists offline once established.
- Workers use a short PIN to switch identity on a device that has
  already authenticated with Clerk at least once online — the PIN is
  a fast local switch, not a replacement for Clerk's session security.
- Every record carries the id of the user who created it
  (`enteredById` / `recordedById` in the schema).
- A worker can edit only their own recent entries; the owner has full
  read access across everything, including costs and profit.
  "Their own recent entries" is enforced in the same place invariant 2
  is — inside `lib/db/`, not in the action above it. `updateMilkRecord`
  takes the editing user's id and succeeds only when it matches the
  record's `recordedById` *and* the record's date is today; anything
  else is a typed `not-yours` / `too-old`, never a thrown error. Each
  module's write helper repeats that check rather than sharing a
  permission layer, so the rule is greppable per model.
- **The owner's edit reach is currently the same as a worker's.** The
  ownership check above has no owner branch: an owner can correct their
  own same-day entry and no one else's. Deliberate for now — a helper
  that takes a role and branches internally is exactly what
  `code-standards.md` forbids, so an owner override has to be a second,
  separately named export, and nothing in Phase 1 needs one yet. Logged
  as open question 13.
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
- **There is no in-app sign-up.** Accounts are created by the owner in
  the Clerk dashboard, and the webhook makes every new Clerk user a
  `WORKER` — so an open sign-up page is a self-enrolment route into farm
  data. The scaffolded `/sign-up` route was removed and is not a public
  route. This closes the app's own front door; the matching **deployment
  requirement** is to restrict sign-ups on the Clerk instance itself
  (dashboard → restrictions), because Clerk's hosted sign-up page is
  reachable independently of this app. The Clerk backend SDK cannot read
  that setting back — `InstanceAPI` exposes only `get()` (id,
  environment, allowed origins) and a write-only `updateRestrictions()`
  — so it cannot be asserted at boot and has to be checked by a human.
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
