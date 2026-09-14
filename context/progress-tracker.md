# Progress Tracker

## Current Phase

Phase 1 — core data entry. Phase 0 (design system, data layer, auth) is
complete and every check in all three of its specs was verified,
including the owner and worker flows walked end to end in a browser
against the live Clerk instance and Postgres.

**All three write paths are built** and verified at the data and action
layers: milk (`04-milk-entry.md`), harvest (`05-land-produce.md`) and
the shop till (`06-shop.md`). Every module is navigable, and the two
questions that gated Shop — 6 and 15 — are answered and implemented.
What remains before Phase 1 can be called done is the browser
walkthrough of each screen; see "In Progress".

## Current Goal

Close out Phase 1 by walking all three screens in a browser, then build
the three-module owner dashboard — which is now unblocked for the first
time, since every module has something real to show.

Cows & Milk went first because `MilkRecord` is the simplest shape and
its `@@unique([date, session])` constraint is the invariant most worth
exercising early. Land & Produce followed, deliberately without its
money-bearing `InputRecord`. Shop came last because it could not be
built without money on screen, and it is where invariant 4 — stock never
negative — first had to hold under real contention.

## Completed

- Project scaffolded: Next.js 16.3.5 (App Router, Turbopack) + React 19
  + TypeScript strict + Tailwind CSS v4.
- Context documentation written (`project-overview.md`,
  `architecture.md`, `ui-context.md`, `code-standards.md`,
  `ai-workflow-rules.md`).
- **`01-design-system.md` — design system and UI primitives** ✅
  - shadcn/ui installed and configured (Radix base, `radix-nova`
    style, `components.json` at the project root, `rsc: true`,
    CSS-variable theming).
  - Primitives generated into `components/ui/` (unmodified since
    generation): `alert`, `badge`, `button`, `calendar`, `card`,
    `dialog`, `dropdown-menu`, `field`, `input`, `input-otp`, `label`,
    `popover`, `select`, `separator`, `sheet`, `skeleton`, `sonner`,
    `table`, `tabs`, `textarea`.
  - `lucide-react` installed (it is also the icon library configured in
    `components.json`).
  - `lib/utils.ts` exports `cn()`.
  - `app/globals.css` rewritten to carry the `ui-context.md` theme, and
    `app/layout.tsx` switched from Geist to Manrope.

### Verification of `01-design-system.md`

| Check from the spec | Result |
| --- | --- |
| All components import without errors | `npx tsc --noEmit` → exit 0 against a temporary file importing every primitive and its sub-parts; the file was deleted afterwards |
| `cn()` works properly | 7/7 cases pass — Tailwind conflict resolution (`px-2 py-1` + `px-4` → `py-1 px-4`), last-wins radius merge, clsx conditional/object/array syntax, `className` override, and no false merge between `text-moss` and `bg-moss` |
| No default light styling appears | Compiled CSS contains **zero** occurrences of shadcn's default neutral palette (`oklch(1 0 0)`, `oklch(0.145 0 0)`, `oklch(0.922 0 0)`, `oklch(0.97 0 0)`, `oklch(0.205 0 0)`) and **zero** `prefers-color-scheme` queries; `body` resolves to `--bg-base` / `--text-primary`, `html` to Manrope, and `rounded-lg/xl/4xl` to 12px/16px/9999px |
| `npm run build` passes | ✅ compiled in 4.0s, 4 static pages |
| `npm run lint` passes | ✅ exit 0 |

- **`02-database` — Prisma schema, client, and query helpers** ✅
  - `prisma/schema.prisma` copied from `context/schema.prisma`; models,
    fields, enums, and constraints are unchanged. The one forced edit is
    the datasource block — see the Prisma 7 decisions below.
  - `prisma.config.ts` supplies `DATABASE_URL` (via `dotenv`) to migrate
    and introspect; `.env` holds the value and stays gitignored, with
    `.env.example` committed as the template.
  - Initial migration `prisma/migrations/20260913161613_init` created and
    applied against the Prisma Postgres instance — all 14 tables live.
  - `lib/db/client.ts` — the shared `PrismaClient`, built on the
    `@prisma/adapter-pg` driver adapter and cached on `globalThis` so hot
    reload cannot open a new pool per edit.
  - `lib/db/animals.ts`, `milk.ts`, `land.ts`, `shop.ts` — thin read
    helpers per module, no business logic, no API routes or server
    actions yet (deliberately out of this unit's scope). Financial
    columns are reachable only through the `...WithPricing()` /
    `...WithFinancials()` exports (invariant 2).
  - `server-only` installed; every `lib/db/*` module imports it.
  - `postinstall: prisma generate` added so a fresh clone has a client.

### Verification of `02-database`

| Check from the spec | Result |
| --- | --- |
| `npx prisma validate` passes | ✅ "The schema at prisma\schema.prisma is valid" |
| `npx prisma migrate dev` runs clean | ✅ applied `20260913161613_init`; `information_schema` lists all 14 tables |
| `lib/db/client.ts` exports a single shared client | ✅ the module was re-imported three times under `--conditions=react-server` (what hot reload does); all three exports were the same object, `globalThis.prismaClient` was the only cache key, and `SELECT 1` returned through it |
| `npm run build` passes | ✅ compiled in 23.6s, 4 static pages |
| `npm run lint` passes | ✅ exit 0 |
| Extra — invariant 1 holds in the database | ✅ `MilkRecord_date_session_key` exists; a second insert for the same date/session was rejected with `P2002`. Run inside a transaction that was rolled back, so no rows were left behind |
| Extra — helpers run against the live schema | ✅ every exported helper in all four modules executed against Postgres (empty results, no errors) |
| Extra — invariant 2 holds at runtime | ✅ one row seeded per money-carrying model (`unitPrice` 12.50, `cost` 45.50/120.00, `totalAmount` 25.00); all 13 default helpers returned rows with **zero** financial keys, line items inside `getSaleById` included, and all 8 privileged helpers returned theirs. Seeded rows were deleted afterwards — every table back to 0 |
| Extra — invariant 2 holds at compile time | ✅ a temporary file asserted `unitPrice` / `totalAmount` / `subtotal` / `cost` are absent from the safe return types via `@ts-expect-error`, and present on the privileged ones; `tsc` exit 0. A negative control (the same assertion pointed at `getStockItemsWithPricing`) failed with TS2578 as it should, so the check is not vacuous. File deleted afterwards |

- **`03-auth.md` — Clerk, the webhook, and the worker PIN layer** ✅
  - `@clerk/nextjs` 7.9.2 installed; `ClerkProvider` inside `<body>`,
    `proxy.ts` running `clerkMiddleware` with everything protected except
    `/sign-in`, `/signed-out`, `/__clerk/*` and the webhook.
  - Schema: `User.pinHash`, `pinSetAt`, `pinFailedAttempts`,
    `pinLockedUntil`; migration `20260913172128_add_worker_pin_fields`.
  - `lib/auth/`: `pin-config.ts` (shared constants), `pin.ts` (scrypt),
    `unlock.ts` (signed session cookie), `session.ts`
    (`resolveAuthGate()`), `actions.ts` (set / unlock / lock).
  - `lib/db/users.ts`: `getUserById`, `getUsers`, `upsertUserFromClerk`,
    `setPinHash`, `verifyPinHash` — `pinHash` is never selected by
    anything but the verifier.
  - `app/api/webhooks/clerk/route.ts`: Svix-verified, creates the row as
    `WORKER`/`active`, idempotent on retry.
  - `app/(app)/` route group applies the gate once; `app/set-pin` and
    `app/lock` sit outside it so a locked worker can reach them.
  - `components/farm/pin-pad.tsx` (4-slot `input-otp`, `h-14`, offline
    and lockout states), `relock-on-foreground.tsx`, `auth-notice.tsx`.
  - `npm run seed:owner -- <clerk-user-id> "<name>"` promotes the owner.
  - App metadata fixed (was still create-next-app boilerplate).
  - Post-review fixes (see the decisions below): atomic attempt
    counting, PIN digits masked, in-app sign-up removed, sign-out
    clears the unlock cookie via `/signed-out`, a sign-out control on
    the blocked-user notice, and a re-lock retry when connectivity
    returns.
  - PIN recovery: `clearPinHash` + owner-only `resetWorkerPinAction`, a
    "Worker PINs" section on the owner's home
    (`components/farm/worker-pin-list.tsx`, `reset-pin-button.tsx`, with
    a two-tap confirm), and a "Forgotten your PIN?" line on the lock
    screen. Added after the walkthrough surfaced the dead end.

### Verification of `03-auth.md`

| Check from the spec | Result |
| --- | --- |
| The webhook rejects an invalid/missing signature | ✅ against a running server: unsigned → 400, wrong signature → 400, valid headers with a tampered body → 400, and no row created by any of the three |
| A worker gets a matching Prisma row with `role: WORKER` | ✅ a correctly Svix-signed `user.created` returned 200 and created one `WORKER`/`active` row with `pinHash` null; a retry was idempotent; `user.updated` was acknowledged without writing |
| 5 wrong PINs lock entry for 60s, tracked server-side | ✅ at the data layer: attempts 1–4 returned `wrong` with a decreasing count, attempt 5 returned `locked` ~60s out, the correct PIN was refused while locked, and an expired lockout restored a full set of attempts |
| `pinHash` is populated on setup | ✅ `setPinHash` stores `salt:key` scrypt hex, rejects non-numeric and wrong-length input, and the plaintext never appears in the column |
| Signed-out routing | ✅ `/`, `/lock` and `/set-pin` all 307 to Clerk sign-in |
| `npm run build` passes | ✅ 7 routes, proxy compiled |
| `npm run lint` passes | ✅ exit 0 (after fixing a `set-state-in-effect` violation in the lockout countdown) |
| Owner signs in through Clerk and reaches the app | ✅ walked in a browser. Clerk sign-up → "Almost there" with the account id shown → `npm run seed:owner` → reload showed "Owner — full access" |
| A worker invited from the Clerk dashboard is auto-created | ✅ a real `user.created` delivery through `clerk webhooks listen` (relay `forward_status: 200`, 5.6s), creating the invited test account as `WORKER`/`active` with `pinHash` null |
| Worker is prompted to set a PIN on first login | ✅ sign-in went to `GET /set-pin`, not home; `POST /set-pin` stored a 161-char `salt:key` scrypt hash (32 + 1 + 128) and populated `pinSetAt` |
| Reopening prompts for the PIN, not a full Clerk login | ✅ backgrounding the tab for ~3s re-locked to the PIN screen; no Clerk re-auth |
| 5 wrong PINs lock entry for 60s (in the browser) | ✅ countdown shown live, correct PIN refused while locked; the counters were back to `0` / `null` after the eventual successful unlock, confirming the reset-on-success path |
| A worker with no connection sees a clear offline state | ✅ DevTools offline → the explicit "checked on the server" message, no silent failure |
| Extra — the attempt counter is atomic | ✅ five wrong attempts fired concurrently now cost exactly five (`pinFailedAttempts` = 5, account locked). A control replicating the old read-then-write pattern counted **1 of 5** on the same database — five parallel guesses used to cost one attempt, which would have let all 10,000 PINs be walked in parallel batches |
| Extra — owner PIN reset | ✅ a worker row with a PIN and a live lockout was cleared: `pinHash`, `pinSetAt`, attempts and lockout all reset, the old PIN then returned `no-pin`, a new PIN was set and verified, and the old one failed against it |

- **`04-milk-entry.md` — the first write path, end to end** ✅ (browser
  walkthrough outstanding — see "In Progress")
  - `lib/db/milk.ts` gained its write half: `createMilkRecord` returns
    a typed `duplicate` carrying the record already in the slot instead
    of letting `P2002` surface, and `updateMilkRecord` enforces
    invariant 2's sibling rule — own entry, logged today — returning
    `not-yours` / `too-old` rather than throwing.
  - `farmDate()` is the single conversion between a clock instant and
    the `@db.Date` civil day a record is filed under.
  - New reads for the two screens: `getMilkRecordsForDate` (optionally
    scoped to one worker) and `getRecentMilkRecords`, both selecting the
    recorder as `{ id, name }` — never `include`, which would carry
    `pinHash` out of `lib/db/` and break invariant 6.
  - `app/(app)/milk/actions.ts` — `logMilkAction` and `editMilkAction`.
    Each resolves the caller through `resolveAuthGate()`, validates with
    `zod`, and calls `refresh()` on success. Neither accepts a user id,
    and `logMilkAction` derives the date server-side.
  - `zod` 4.6.4 installed — the first use of the validator
    `code-standards.md` has always called for.
  - `lib/milk-config.ts` — entry bounds shared by the stepper and the
    action, following the `pin-config.ts` precedent.
  - `components/farm/quantity-stepper.tsx` and `session-toggle.tsx`, the
    first two entry controls, plus `milk-entry-form.tsx` and
    `milk-history-list.tsx` composing them into the screen both roles
    use.
  - `app/(app)/page.tsx` now routes on role: `WORKER` → the milk entry
    screen and their own "logged today" list, nothing else; `OWNER` →
    the Cows & Milk module home, the same form plus a recent-history
    list across all workers. The owner's "Worker PINs" section was kept
    — a forgotten PIN still has no other way out.

### Verification of `04-milk-entry.md`

Run against the live Prisma Postgres with two temporary worker rows,
all of which — and their records — were deleted afterwards; the table
was back to 0 rows.

| Check from the spec | Result |
| --- | --- |
| A worker logs a morning entry, then an evening entry, same day — both succeed | ✅ both returned `{ ok: true }`; the second is not blocked by the first, because the constraint is on the pair |
| A second attempt at an already-logged session returns the typed duplicate result | ✅ a different worker's 20 L morning entry came back `{ ok: false, reason: "duplicate" }` carrying the 12 L record already in the slot — no thrown `P2002` |
| A worker can edit their own same-day entry | ✅ 12 → 13.5 L |
| Editing another worker's entry is rejected with the typed reason | ✅ `not-yours`. An id that does not exist returns the same reason rather than a third one, so a caller cannot probe for real ids |
| Editing their own entry from a prior day is rejected | ✅ `too-old` |
| Owner's module home shows entries from more than one worker in one list | ✅ `getRecentMilkRecords` returned both workers' names in one result, newest day first |
| `npm run build` passes | ✅ compiled in 8.9s, 8 pages, 7 routes |
| `npm run lint` passes | ✅ exit 0 |
| Extra — the joined recorder carries no `pinHash` | ✅ the `recordedBy` object on every row has exactly the keys `id` and `name` (invariant 6) |
| Extra — a stored date reads back as the day it was logged | ✅ every row's `date` equalled `farmDate()` exactly, and `farmDate()` strips the time of day from any instant it is handed |
| Extra — action input validation | ✅ 12 cases through the action's schema: an unknown session, a missing session, liters as a string, zero, negative, over the 2000 L ceiling, `NaN`, `Infinity` and a `null` body are all rejected; a client-supplied `recordedById` is stripped and never reaches the query helper |
| Extra — the action endpoint is not reachable unauthenticated | ✅ against a running dev server, a forged `Next-Action` POST to `/` was 307'd to sign-in by `proxy.ts`, before any action code ran |
| Extra — routes compile and the gate holds | ✅ `GET /` and `GET /milk` both 307 to Clerk sign-in; `/milk` has no page by design, only `actions.ts` |

- **`05-land-produce.md` — the second write path** ✅ (browser
  walkthrough outstanding — see "In Progress")
  - `lib/db/land.ts` gained its write half: `createField`,
    `createCropCycle` (defaulting to `PLANNED`) and `createHarvestRecord`.
    The two that take a foreign key return a typed `unknown-field` /
    `unknown-cycle` instead of letting a `P2003` surface.
  - `createHarvestRecord` is a plain insert by design. Unlike
    `MilkRecord` nothing here is unique per day: a cycle can legitimately
    be harvested twice — a partial pick, then the rest — so two entries
    on one date are correct data, not a duplicate to catch.
  - `getCropCyclesForSelection()` (id, cropType, field name) and
    `getHarvestHistory()` (recorder as `{ id, name }`, never `include`).
  - `app/(app)/land/actions.ts` — `createFieldAction`,
    `createCropCycleAction`, `logHarvestAction`. The two `create*` run
    `requireOwner()` first, before any parsing and long before any write.
  - `lib/auth/roles.ts` — `requireOwner()`, split out of `session.ts` so
    it is pure and directly testable; Shop will want the same gate.
  - `lib/db/dates.ts` — `farmDate()` moved out of `milk.ts` now that a
    second module needs it, joined by `parseFarmDate()` (which rejects
    "2026-02-31" rather than rolling it into March) and
    `toDateInputValue()`.
  - `lib/land-config.ts` — harvest bounds plus the fixed unit set, since
    `HarvestRecord.unit` is a free `String` and `sumHarvestQuantity()`
    groups by it.
  - `components/farm/choice-grid.tsx` — the full-width option cells
    generalised out of `session-toggle.tsx`, now with a module accent.
    `SessionToggle` is a thin wrapper over it; its API did not change.
  - `harvest-entry-form.tsx`, `harvest-history-list.tsx`,
    `field-form.tsx`, `crop-cycle-form.tsx`, and `app/(app)/land/page.tsx`
    at `/land`: both roles log a harvest, only the owner sees Setup.
  - A single `/land` link on the home screen for both roles — see open
    question 15 for why the worker gets one.

### Verification of `05-land-produce.md`

Run against the live Prisma Postgres with a temporary owner and worker,
all of whose rows were deleted afterwards.

| Check from the spec | Result |
| --- | --- |
| A worker can create a `Field` or `CropCycle`? | ✅ No. `requireOwner()` — the actual function both actions call, exercised directly against all six gate states — returns `not-owner` for a ready worker and `not-allowed` for signed-out, needs-unlock, needs-pin-setup, no-record and revoked callers. It runs before `safeParse` and before any query, so nothing is written or read. `not-owner` is its own status, distinct from `invalid` |
| An owner creates a `Field`, then a `CropCycle` against it, then either role logs a `HarvestRecord` | ✅ walked through the helpers in order; the cycle defaulted to `PLANNED` and both the owner and a worker logged against it |
| Two harvest entries against the same cycle on the same day both succeed | ✅ three were logged on one date and all three persisted — `count` returned 3, nothing collapsed |
| The harvest history shows entries from more than one recorder, joined as `{ id, name }` only | ✅ two distinct recorder names in one list; the `recordedBy` object has exactly the keys `id` and `name` |
| `npm run build` passes | ✅ 9 pages, `/land` compiled |
| `npm run lint` passes | ✅ exit 0 |
| Extra — a bad foreign key is typed, not a crash | ✅ a cycle on an unknown field returned `unknown-field`; a harvest on an unknown cycle returned `unknown-cycle` |
| Extra — no financial column leaks | ✅ no `cost` / `unitPrice` / `totalAmount` on any harvest row, and no `pinHash` on the joined recorder (invariant 6) |
| Extra — the picker selection is minimal | ✅ exactly `id`, `cropType`, `field` — no dates, no status |
| Extra — dates | ✅ `parseFarmDate` rejects a non-date and 31 February, and reads a real day as midnight UTC; a cycle's planting and expected-harvest dates read back as the civil days given |
| Extra — action input validation | ✅ 26 cases across the three schemas: empty names, zero/negative/NaN/over-ceiling acres, impossible and non-dates, an expected harvest before its planting date, an unknown unit, a string quantity, `Infinity`, a `null` body — all rejected; an empty optional note becomes `null` rather than `""`; a client-supplied `recordedById` is stripped |

- **Open questions 6 and 15 settled, before `06-shop.md` is drafted** ✅
  Both gated Shop, and the tracker said so: 6 because Shop is entirely
  financial, 15 because Shop is the third destination that finally
  breaks a hardcoded `/land` link.
  - **6 — money is integer cents.** `lib/db/money.ts` (`toCents` /
    `fromCents`, plus nullable variants) is the only conversion, both
    directions. All seven privileged helpers across `animals.ts`,
    `land.ts` and `shop.ts` now return `...Cents` integers, so no
    `Decimal` leaves `lib/db/` anywhere. `fromCents()` throws on a
    fractional cent rather than rounding.
  - **15 — `User.assignedModules Module[] @default([])`**, migration
    `20260913205123_add_worker_module_assignment`. Empty means all
    three, so the change took nothing from any existing row.
    `lib/modules.ts` interprets it; `components/farm/module-nav.tsx`
    renders it and replaced both the hardcoded `/land` link on the home
    screen and the hand-rolled "Back" link on `/land`.
  - The `prisma/schema.prisma` edit was made deliberately, as
    `ai-workflow-rules.md` requires of a protected file, and
    `context/schema.prisma` carries the same edit byte-for-byte.
  - Open question 18 (desktop layout) logged, having been raised earlier
    and never recorded. Open question 19 (an owner control to actually
    narrow an assignment) logged as the deliberate follow-up to 15.

### Verification of the two decisions

| Check | Result |
| --- | --- |
| Cents conversion is exact | ✅ 12.50 → 1250, 0.01 → 1, 0 → 0, and 99999999.99 (the `Decimal(10, 2)` ceiling) → 9999999999 without loss |
| The round trip is lossless | ✅ seven amounts through `Decimal` → cents → `Decimal` all returned identical, including 0.07 and 0.10 |
| Cents arithmetic beats the float it replaces | ✅ `0.1 + 0.2 !== 0.3` while `10 + 20 === 30`; a 3-line sale at 19.99 came to exactly 5997 cents / 59.97 |
| A fractional cent is refused, not rounded | ✅ `fromCents(12.5)` throws |
| Privileged helpers return integers, not `Decimal` | ✅ against a live `StockItem` at 12.50, `getStockItemsWithPricing` returned `unitPriceCents: 1250` with no `unitPrice` key and no `Decimal` instance |
| Invariant 2 still holds | ✅ the safe `getStockItems` returns neither `unitPrice` nor `unitPriceCents` |
| Writes convert back | ✅ writing `fromCents(1999)` stored 19.99 in the column |
| An empty money aggregate is 0, not null | ✅ `sumInputCostWithFinancials` on a cycle with no inputs returned `{ totalCents: 0 }` |
| An empty assignment means all three modules | ✅ `modulesFor([])` returns all three; `modulesFor(["LAND"])` returns only Land |
| Assignment order is stable | ✅ `modulesFor(["SHOP", "MILK"])` returns MILK, SHOP — registry order, not stored order |
| Shop can be assigned but never linked | ✅ its `href` is null, so the nav filters it out until the route exists |
| A new row defaults to empty | ✅ a freshly created user came back with `assignedModules: []`, and `getUserById` still omits `pinHash` (invariant 6) |
| A narrowed assignment round-trips | ✅ `["LAND", "SHOP"]` stored and read back, resolving to Land alone once Shop is filtered for having no route |
| **The migration took access from nobody** | ✅ counted against the live table: **zero** existing users have a non-empty assignment, so every one of them still sees every module |
| `npm run build` / `npm run lint` / `tsc` | ✅ all pass |

- **`06-shop.md` — the third write path** ✅ (browser walkthrough
  outstanding — see "In Progress")
  - **Part 1 was already done.** `enum Module`, `User.assignedModules`,
    the migration, the module nav and `lib/db/money.ts` all landed when
    open questions 6 and 15 were settled ahead of this spec being
    drafted. Re-checked line by line against Part 1's wording; the only
    gap was that `SHOP` had no route, which this unit gives it.
  - `lib/db/shop.ts`: `createStockItem`, `recordSale`,
    `getStockItemsForSale`, `getSalesHistory` and its
    `...WithFinancials()` twin.
  - `recordSale` is one transaction. Each line decrements with a
    conditional `updateMany` (`quantity: { gte: requested }`); a zero
    affected count rolls the whole sale back and returns a typed
    `insufficient-stock`. Prices are read from the stock rows *inside*
    the transaction — a till never names its own price.
  - `app/(app)/shop/actions.ts` — `createStockItemAction` (owner-gated as
    its first statement) and `recordSaleAction`. Cents in both
    directions, never a `Decimal`.
  - `lib/shop-config.ts` for the bounds; `lib/money.ts` for
    `formatCents()`, added now that money is finally on a screen.
  - The till (`sale-terminal.tsx` + `stock-item-grid.tsx`), the owner's
    `stock-item-form.tsx`, `sales-history-list.tsx`, and
    `app/(app)/shop/page.tsx` at `/shop`. `SHOP` gained its route in
    `lib/modules.ts`, so all three modules are now navigable.

### Verification of `06-shop.md`

Run against the live Prisma Postgres with a temporary owner and worker;
every row created was deleted afterwards and the three shop tables were
back to 0.

| Check from the spec | Result |
| --- | --- |
| A worker cannot create a `StockItem`, and the rejection happens before validation | ✅ `requireOwner()` is the first statement in `createStockItemAction`, before `safeParse`; a ready worker gets `not-owner`, distinct from `invalid` |
| Overselling is refused with the typed `insufficient-stock`, no partial sale | ✅ a 99-unit sale against 7 in stock returned the typed reason naming the item, `available: 7` and `requested: 99`; stock was untouched and no `Sale` row was created. A two-line sale where only the second line overran rolled the first line's decrement back too |
| **Verified under concurrency, not just sequentially** | ✅ ten simultaneous sales of 2 against 10 in stock: **exactly 5 succeeded**, 5 returned `insufficient-stock`, stock landed on **exactly 0**, and `SaleItem` rows summed to exactly 10 units |
| Control — the test is not vacuous | ✅ the read-then-write pattern this replaces, run against the same database and the same 10 units, left **8** in stock: nine of the ten decrements were lost. The conditional update left 0 |
| A successful sale decrements by exactly the sold quantity and prices from the item's price at sale time | ✅ 3 × 12.50 decremented 10 → 7 and wrote `unitPrice` 12.50 / `subtotal` 37.50 / `totalAmount` 37.50. Repricing the item to 99.00 afterwards left the existing `SaleItem` at 12.50 |
| No `Decimal` in a client-rendered payload | ✅ every payload the shop page passes to a component was walked recursively — `getStockItemsForSale`, both history reads, nested line items included — and contains **zero** `Prisma.Decimal` instances; every money field is an integer `...Cents` |
| A worker assigned `SHOP` but not `LAND` sees only the shop link | ✅ `modulesFor(["SHOP"])` resolves to Shop alone, and `ModuleNav` drops the module being viewed |
| `npm run build` passes | ✅ 10 routes, `/shop` compiled |
| `npm run lint` passes | ✅ exit 0 |
| Extra — an unknown item is its own reason | ✅ `unknown-item`, not `insufficient-stock`; a conditional update matches no rows in both cases, and telling a worker "not enough stock" about something that never existed sends them to count a shelf that isn't there |
| Extra — duplicate lines merge | ✅ two lines of 2 for one item became one line of 4 and one decrement of 4, so neither could pass the stock check on its own |
| Extra — invariant 2 at the last mile | ✅ the worker's `getSalesHistory` carries no key matching total/price/subtotal/amount/cost anywhere, line items included; the owner's twin carries all of them as integer cents |
| Extra — a new item starts at zero stock | ✅ stocking the shelf stays a separate explicit act (invariant 3) |
| Extra — `formatCents` | ✅ 3750 → "37.50", 5 → "0.05" |

## In Progress

Both `04-milk-entry.md` and `05-land-produce.md` are built and verified
everywhere they can be without a Clerk session. What is left in each is
browser work, and it is **not yet done**:

**Milk**

1. The unique(date, session) constraint exercised **through the real
   UI** — log a session, then log it again, and confirm the screen says
   "already logged at N L by X" rather than crashing. The constraint
   itself is proven at the data layer; what is unproven is the message
   reaching the screen.
2. The same-day edit and its two refusals walked in the browser.

**Land**

3. The owner path walked: add a field, open a cycle on it, log a
   harvest, then log a second one against the same cycle the same day
   and confirm both appear.
4. The worker path walked: reach `/land` from the home screen, log a
   harvest, and confirm the Setup section is absent.

**Shop**

5. The owner path walked: add a stock item, restock it (directly in the
   database for now — see open question 21), ring up a sale, and confirm
   the total appears on the history row.
6. The worker path walked: reach `/shop`, ring a sale, and confirm the
   Setup section is absent **and that no total shows on any history
   row** — that last part is invariant 2 at the last mile, and it is the
   one thing on these screens a data-layer test cannot see.
7. An oversell attempted through the real UI at least once, so the typed
   refusal is confirmed to reach the screen as a message rather than a
   crash.

Worth watching on the first walkthrough of either: every form and list
on both screens is server-rendered, and the actions call `refresh()` to
re-render them in the action's own response. If a saved entry does not
appear in its list without a manual reload, that is the thing to look at
first — it is the one mechanism common to both units that no offline
test can reach.

## Next Up

1. Finish the walkthroughs above.
2. **The three-module owner dashboard** — the metric card grid and the
   cross-module "needs attention" list. Unblocked for the first time:
   all three modules now have data worth showing. Per
   `ai-workflow-rules.md`, Phase 3 (PowerSync offline sync) does not
   start until Phase 1 is complete.
3. Land's own `InputRecord` — cost entry and the cost-vs-yield
   reporting it feeds. Left out of `05-land-produce.md` because it
   forced open question 6; that is now answered, so it is unblocked
   whenever it is wanted.
4. The animal registry, health records and breeding records; the
   `CropCycle` status transition (`PLANNED` → `GROWING` → `HARVESTED`).
   All deliberately left out of the write paths because they neither
   block them nor share them.

## Open Questions

1. ~~**Worker vs. owner visual treatment.**~~ Resolved — `ui-context.md`
   now carries an "Owner vs. Worker Treatment" table (panel edge,
   padding, type scale, touch target). Forced by the PIN screens, which
   are the first worker-facing UI.
2. ~~**Primary action button size.**~~ Resolved — `h-14`, `text-lg`,
   `font-semibold`, `rounded-xl`, full width on worker screens, applied
   by className so `components/ui/button.tsx` stays as generated.
3. ~~**App metadata.**~~ Resolved — `app/layout.tsx` now carries the real
   title and description.
4. **Sidebar tokens.** `--sidebar-*` variables are mapped to the
   palette for completeness, but no layout in `ui-context.md` uses a
   sidebar. Drop them if a sidebar never materialises.
5. ~~**Where the worker cost/price filter lives.**~~ Resolved — it lives
   inside `lib/db/` as two exports per financial query. See the
   decision below; `architecture.md` invariant 2 and
   `code-standards.md` now carry the rule.
6. ~~**`Decimal` across the server/client boundary.**~~ Resolved —
   **integer cents**, converted at the `lib/db/` boundary in both
   directions by `toCents()` / `fromCents()` in `lib/db/money.ts`. The
   original guess in this entry was a string at the DTO boundary; that
   was rejected on inspection. A string displays fine but cannot be
   arithmetic, and the POS screen recalculates quantity × price on every
   stepper tap — so a string would have to be parsed back into a float
   exactly where precision matters most, which is the problem the
   `Decimal` column exists to prevent. Integer cents are exact at any
   scale this farm will see, the client never holds a float representing
   money, and formatting happens only at final render. Every cents value
   is named for its unit (`unitPriceCents`, `costCents`, …) so a bare
   1250 cannot be misread as 1,250 whole units. All seven existing
   `...WithPricing()` / `...WithFinancials()` helpers were converted, so
   no `Decimal` leaves `lib/db/` anywhere. `architecture.md` and
   `code-standards.md` now carry the rule.
7. **`prisma-client-js` is deprecated.** It still generates in 7.10.0 and
   the schema is unchanged from `context/schema.prisma`, but Prisma's
   newer `prisma-client` generator writes to an explicit `output` path
   instead of `node_modules`. Switch deliberately, not during a feature.
8. ~~**The Clerk CLI and the app keys point at different instances.**~~
   Resolved by `clerk unlink`. The CLI had auto-linked this directory to
   an application via the **git remote**, and that link silently took
   precedence over `CLERK_SECRET_KEY` in `.env` — `clerk whoami` showed
   `localSecretKeySource: null` while linked, and `.env` the moment it
   was unlinked. `clerk users list` now returns the app's real users.
   `clerk doctor` reports "Not linked — using the accountless
   application", which is the correct state here: linking would need the
   Clerk account that owns the app to be logged in, and the app ID
   written into `03-auth.md` 404s for the account the CLI is signed into.
   The trade-off is that unlinked mode "covers fewer settings" —
   account-level configuration is not reachable, but everything
   instance-scoped (users, webhooks) is.
9. **Re-lock threshold on foreground.** The spec says "opened or
   foregrounded". Opening is covered by the session cookie. For
   foregrounding, `relock-on-foreground.tsx` ignores hides shorter than
   2 seconds, so a notification shade or a permission prompt does not
   lock a worker out mid-entry. That 2s is a guess — watch it in real
   use and move it into `ui-context.md` once there is a real answer.
10. ~~**Changing an existing PIN.**~~ Resolved — the owner resets it.
    `resetWorkerPinAction` (owner-only, role checked server-side) clears
    `pinHash`, `pinSetAt`, the attempt count and any lockout; the worker
    picks a new PIN on their next open. The lock screen now says so
    instead of dead-ending. A worker still cannot change their own PIN
    while they remember it — that is a deliberate gap, not an oversight:
    see the reasoning in `architecture.md`.
11. **Production migration path.** `prisma migrate dev` is a development
   command and was used here against the shared Prisma Postgres
   instance. Deploys should run `prisma migrate deploy`; decide where
   that runs (CI step vs. release script) before anything is deployed.
12. **Which clock decides "today".** `farmDate()` builds a record's
   civil day from the *server's* timezone, and `updateMilkRecord`'s
   same-day rule compares against it. Locally that is the farm's
   timezone; on a host running UTC it is not, and an evening milking
   logged after the UTC rollover would file under tomorrow and be
   uneditable the moment it was saved. The fix is a single configured
   farm timezone (env var) that `farmDate()` and the screens' date
   formatting both read. Needed before the first deploy, not before the
   next feature — nothing else in the app has a date-only column yet.
13. **The owner cannot edit a worker's entry.** `updateMilkRecord`
   checks ownership with no owner branch, so today an owner can correct
   only their own same-day entries — narrower than the "owner has full
   edit access" line `architecture.md` used to carry (now corrected
   there). A role parameter is not the answer; `code-standards.md`
   forbids a helper that branches on role. If the owner needs the
   reach, it is a second, separately named export next to it. Wait for
   a real need — a worker who mistyped and went home — rather than
   building it speculatively.
14. **The worker's sync-status indicator.** `ui-context.md` says a
   worker entry screen shows a "saved locally" indicator at all times.
   There is nothing local to save to until PowerSync lands in Phase 3,
   so the entry screen currently says nothing rather than claiming a
   local save it did not make. Add the indicator with the sync layer,
   not before.
15. ~~**A worker has no assigned module, so they can reach both.**~~
   Resolved — `User.assignedModules Module[] @default([])`, with a new
   `enum Module { MILK LAND SHOP }`. A plain Postgres array column; no
   join table, because a module list is a fixed, tiny set with nothing
   to hang off the relationship. **Empty means all three**, which is
   what makes it additive rather than a regression: every row that
   existed before the migration has an empty array and keeps exactly the
   access it had. `lib/modules.ts` interprets it and
   `components/farm/module-nav.tsx` renders it, replacing the hardcoded
   `/land` link the Land unit left behind. A module with no screen yet
   (Shop) is never linked, so an assignment can name it before it
   exists. Migration `20260913205123_add_worker_module_assignment`.
   An owner-facing screen to actually narrow a worker's assignment is a
   follow-up, not part of this change — see open question 19.
16. **The harvest unit set is a guess.** `HarvestRecord.unit` is a free
   `String` in the schema, but `sumHarvestQuantity()` groups by it, so
   free text would split one crop's yield across "kg", "Kg" and "kilos"
   and never add up. `lib/land-config.ts` pins it to kg / bags / crates
   / bunches. Those four were chosen, not researched — confirm them
   against how the farm actually measures a harvest, and note that
   changing the set later does not rewrite rows already stored.
17. **Two identical crop cycles are indistinguishable in the picker.**
   `getCropCyclesForSelection()` returns id, cropType and field name —
   what the spec asked for — so two maize cycles in the same field read
   the same. It cannot happen yet, because nothing closes a cycle and
   there is only ever one season's worth. The moment the `PLANNED` →
   `GROWING` → `HARVESTED` transition lands, the picker needs either the
   planting year or a filter to open cycles.
18. **Nothing defines what any screen looks like on a computer.**
   `project-overview.md` puts "a PWA usable on both phone and computer"
   in scope, and `architecture.md` lists the platform as phone **and**
   computer. But every screen built so far is phone-shaped: a single
   column capped at `max-w-xl` (worker) or `max-w-2xl` (owner), which on
   a desktop is a narrow strip in the middle of an empty page. Nothing
   in `ui-context.md` describes a wide-viewport layout, and its only
   mention of the axis is one clause about the owner dashboard's metric
   grid "collapsing to a single column on phone widths" — a dashboard
   that does not exist yet. The open question is whether a computer gets
   a genuinely different layout (multi-column, a persistent module
   sidebar — note the unused `--sidebar-*` tokens in open question 4) or
   whether the centred phone column is the intended answer for both.
   Worth settling before the owner dashboard is built, since that is the
   screen where the difference actually costs something. **Logged late:
   this was raised earlier and never recorded, which is why it is here
   now rather than at its proper number.**
19. **No way to narrow a worker's module assignment.**
   `User.assignedModules` exists and is enforced (open question 15), but
   nothing writes it — every worker's array is empty, so everyone is
   offered every module. The owner needs a control for it, most
   naturally beside the existing "Worker PINs" section on their home
   screen, which is already the one owner-facing admin surface. Small,
   and deliberately not bundled into the schema change.
20. **No currency is named anywhere.** `project-overview.md` rules
   multi-currency out of scope, so there is exactly one — it has simply
   never been written down. `formatCents()` therefore renders a bare
   grouped amount ("1,234.56") with no symbol, because inventing one
   would put a fabricated fact on every price tag and receipt. Name it
   in `ui-context.md` and the formatter takes one line to change.
21. **Nothing restocks the shop.** `createStockItem` starts an item at
   zero and `recordSale` only decrements, so stock can go down and
   never up through the UI. `StockAdjustment` exists in the schema with
   a `RESTOCK` type and `getStockAdjustments()` already reads it, but
   `06-shop.md` did not ask for the write and inventing it would have
   been scope the spec deliberately left out. Until it lands, a shelf is
   stocked by editing the database. This is the most immediately
   practical gap of the three.
22. **A sale writes no `StockAdjustment`.** The enum carries
   `SALE_DEDUCTION`, which strongly suggests sales are meant to leave a
   trace in the movement log, but `06-shop.md` specified `recordSale` as
   `Sale` + `SaleItem` only and that is what was built. The effect is
   that the adjustment log is not a complete history of stock movement —
   anything reading it to reconcile a shelf will be wrong by whatever
   has been sold. Decide it with open question 21, since they touch the
   same table.
23. **Pending vs. revoked is inferred, not recorded.** An inactive row
   is read as *pending* when `pinSetAt` is null and *revoked* when it is
   not, which is right in every ordinary case. The one it reads
   generously: an owner approves someone, that person never opens the
   app, and the owner then revokes them — they see "Waiting for
   approval" rather than "Access revoked". Both are true enough, and
   neither has access. An explicit `approvedAt DateTime?` on `User`
   would make it exact; it is a schema change, so it waits for a
   deliberate decision rather than riding along with a security fix.
24. **A checkout retry could take payment twice.** If the network drops
   *after* `recordSaleAction` commits but before the response arrives, the
   till shows a failure for a sale that actually happened. The message no
   longer claims the sale wasn't recorded — it now says to check the
   recent sales list first — but that is a mitigation, not a fix. The
   fix is an idempotency key: a stable id generated per checkout, sent
   with the request, and stored under a unique constraint so a retry
   returns the original sale instead of ringing a second one.
   `Sale.clientId` is already `String? @unique` and is exactly the right
   column — but it is reserved for the PowerSync layer, which will need
   it to reconcile offline writes. Building a competing mechanism now
   would mean two ideas about what `clientId` means. Do it **with**
   Phase 3, where the same key serves both.

## Architecture Decisions

- **shadcn/ui confirmed** as the component library, resolving the
  "assumed — confirm" notes that were in `architecture.md` and
  `ui-context.md`. Both files have been updated.
- **`field` replaces `form`.** This registry version ships
  `components/ui/field.tsx` instead of the older `form` component;
  `form` resolves in the registry but generates no files. `Field` is
  the form-composition primitive going forward.
- **`cn()` comes from the `cn` package**, shadcn's current convention
  and a drop-in replacement for `clsx` + `tailwind-merge` with the same
  API. `lib/utils.ts` re-exports it, so both `@/lib/utils` and `cn`
  resolve to the same helper. Verified behaviourally, not assumed.
- **Theme applied by token remapping, never by editing primitives.**
  `app/globals.css` redefines shadcn's semantic variables in terms of
  the `ui-context.md` palette, so `components/ui/*` stays exactly as
  generated and remains a protected directory.
- **`--primary` is `--text-primary`** (deep olive-charcoal), not one of
  the module accents — `ui-context.md` explicitly rejects a single
  generic brand colour, and the three accents must keep meaning "which
  module".
- **`--secondary`, `--muted` and `--accent` all resolve to
  `--border-default`.** Mapping them to `--bg-base` would have made
  ghost/outline hover states invisible on the page background. The
  trade-off is that an outline button's border matches its own hover
  fill; shadcn's own defaults collapse the same way.
- **The `dark` variant is kept but neutered.** It stays scoped to a
  `.dark` ancestor the app never renders. Deleting `@custom-variant
  dark` would make Tailwind fall back to `prefers-color-scheme: dark`
  and activate the `dark:` utilities baked into the generated
  primitives — the exact behaviour `code-standards.md` forbids. The
  `.dark` palette block itself was removed, `color-scheme: light` is
  set on `:root`, and `<Toaster theme="light" />` overrides the
  generated Toaster's next-themes `system` default.

- **Prisma pinned to 7.10.0, not the 8.0.0-rc CLI.** `prisma` and
  `@prisma/client` must match, and npm's `latest` tag for the `prisma`
  CLI is currently `8.0.0-rc.14` while `@prisma/client` stops at
  `7.10.0` — so a plain `npm i -D prisma` had left the repo with a v8 CLI
  driving a v7 client. Prisma 8 is a different product surface
  (`contract.prisma`, `prisma db migrate`, Composer modules) with no
  `validate` or `migrate dev`, and it contradicts both `architecture.md`
  and the `02-database` spec. The CLI is now pinned to the stable 7.10.0
  that matches the client.
- **The datasource block lost its `url`.** Prisma 7 rejects
  `url = env("DATABASE_URL")` in a schema file outright (P1012). The URL
  lives in `prisma.config.ts` for the CLI and reaches the runtime client
  through the driver adapter. This is the only change made to the
  canonical schema, and `context/schema.prisma` carries the same edit so
  the two stay byte-identical.
- **Postgres is reached through `@prisma/adapter-pg`.** Prisma 7 has no
  built-in connection layer; a driver adapter is how the client connects.
  `pg` and `@types/pg` exist for that reason, not as a second data path.
- **The client is cached on `globalThis` in development only.** Hot
  reload re-evaluates modules, and a fresh `PrismaClient` per reload
  would leak connection pools. Production evaluates once, so the cache is
  skipped there. Verified rather than assumed — see the table above.
- **The PIN hash stays on the server, against the original plan.**
  `03-auth.md` called this out and `architecture.md` now records it: a
  hash of a 4-digit secret sitting on every shared device is
  brute-forceable offline, and a device-side attempt counter is reset by
  clearing app data. The cost is that unlocking needs a network call, so
  the lock screen has an explicit offline state.
- **scrypt from `node:crypto`, not bcrypt or argon2.** No native module,
  so nothing to compile on Windows or in CI, and `scrypt` is a memory-
  hard KDF in the standard library. Stored as `salt:derivedKey` hex with
  a fresh 16-byte salt per PIN, compared with `timingSafeEqual`.
- **Constants live in `pin-config.ts`, hashing in `pin.ts`.** The lock
  screen is a client component and cannot import a `server-only` module,
  but it must show the same attempt limit the server enforces. Splitting
  the constants out is what lets both sides share one source of truth.
- **The unlock is a signed session cookie, not a database session.** It
  names the user it was issued for, so a second worker switching in on
  the same device does not inherit the first one's unlock, and it is
  signed with `PIN_UNLOCK_SECRET` so it cannot be hand-written to skip
  the PIN. It is a convenience marker only — Clerk still authenticates
  every request.
- **Failed PIN attempts are counted by the database, not by the app.**
  A read-then-write of `pinFailedAttempts` let concurrent attempts
  overwrite each other: measured, five parallel wrong guesses cost one
  attempt, which reduces the five-try lockout to nearly no limit at all.
  `{ increment: 1 }` makes each attempt cost exactly one, and the
  lockout is computed from the value the database returns.
- **A worker's PIN is never shown while it is typed.** The generated
  `InputOTPSlot` prints the real character and is protected, so a filled
  slot is styled `text-transparent` with a dot drawn over it instead of
  editing `components/ui/`.
- **Re-lock on foreground retries rather than locking optimistically.**
  If `lockAction()` cannot reach the server the app stays unlocked and
  retries on the next `online` event. Locking the UI locally would
  strand a worker in front of a screen they cannot unlock, because the
  PIN check is server-side by design. The residual window — an offline
  device handed over between workers before the retry lands — is
  accepted, and is the same trade-off as the PIN check itself.
- **The gate lives in a route-group layout, not in `proxy.ts`.** Proxy
  runs before rendering and should not reach for Prisma; `app/(app)/`
  applies `resolveAuthGate()` once for every screen underneath it.
- **Invariant 2 is enforced inside `lib/db/`, not above it.** Each query
  that touches money is two exports: a plainly named default that lists
  its columns with an explicit `select` and leaves the financial ones
  out, and a `...WithPricing()` / `...WithFinancials()` twin that returns
  them, callable only after the caller has checked `role === OWNER`. No
  helper takes a role parameter and branches internally — an audit greps
  for the suffix and finds every privileged path. Explicit `select`
  (rather than `omit`) is what makes it hold over time: a financial
  column added to `schema.prisma` later is absent from the safe path by
  default instead of silently joining it. The split exists in
  `shop.ts` (`unitPrice`, `totalAmount`, `subtotal`), `land.ts` (`cost`)
  and `animals.ts` (`cost`); `milk.ts` has no financial column and so has
  one path per query.
- **Collection readers are named `get*`.** `getStockItems()` sets the
  convention the rest of `lib/db/` follows, so the safe name and its
  privileged twin differ only by suffix.
- **`lib/db/` is read-only for now.** The spec scoped this unit to schema
  + client + query helpers, so no writes, no server actions, no API
  routes. Write helpers arrive in Phase 1 next to the server actions that
  call them, where the role check and validation live.
- **`server-only` is installed even though Next.js handles the import
  internally.** The Next 16 data-security guide recommends installing it
  so lint rules don't flag an extraneous dependency.

- **A duplicate slot is a result, not an exception.** The
  `@@unique([date, session])` constraint *is* invariant 1, so a second
  entry for a session is an ordinary thing for a worker to try, not a
  fault. `createMilkRecord` catches `P2002` and returns
  `{ ok: false, reason: "duplicate", existing }` so the screen can name
  the liters and the person already in the slot. Catching it — rather
  than reading the slot first and then writing — is also the only
  version that is actually safe: a read-then-write leaves a window in
  which two devices both find the slot empty, and the constraint is
  what closes it.
- **The create retries once, and only when the slot is empty again.**
  "Someone holds this slot" and "the row that held it has been deleted"
  are different races. If the post-`P2002` lookup finds nothing, the
  slot is free and a single retry takes it; a second failure with
  nothing to point at throws, because that is a real fault and not
  something to report to a worker as a duplicate.
- **`updateMilkRecord` takes the editing user's id, not a role.** The
  "own recent entries" rule is enforced inside `lib/db/`, next to
  invariant 2's financial split and for the same reason: a permission
  layer above the query is one that a later caller can route around.
  A missing record returns `not-yours` rather than a third reason, so
  an id the caller may not edit cannot be probed for existence.
- **The date comes from the server, the record id comes from the
  client.** `logMilkAction` derives today itself; `editMilkAction`
  accepts an id and re-checks ownership against the session. This is
  the split the Next 16 server-actions guide describes — the client
  says *which* record, never *whose* — and it matters because a
  client-supplied date would let a caller write into a slot they are
  then not allowed to edit.
- **Actions use `refresh()`, not `revalidatePath()`.** Both screens read
  Postgres directly through Prisma, so there is no cached data to
  invalidate; what has to change is the current route's render.
  `refresh()` is what Next 16 documents for exactly that, and it ships
  the new RSC payload inside the action's own response rather than
  costing a second round trip.
- **Entry bounds live in `lib/milk-config.ts`, shared by both sides.**
  Same shape as `pin-config.ts`, same reason: the stepper is a client
  component, and a maximum the UI offers but the action rejects is a
  bug that only shows up in the field. The file also owns the rounding,
  which is what keeps a run of `+ 0.5` taps from storing
  `12.300000000000001`.
- **`MilkSession` is imported as a type in client components, as a
  value only on the server.** `z.enum(MilkSession)` in the action reads
  the real enum, so a third session added to the schema is a type error
  rather than a silently unvalidated value; the toggle takes the
  type alone, so the Prisma client never reaches the browser bundle.
- **Both roles get `h-14` controls; only density differs.** The
  owner/worker table in `ui-context.md` splits panel edge, padding and
  button width — not target size. One control that renders at two
  heights is a second thing to keep right for no gain, and the owner
  uses the same phone.
- **A missing foreign key is a result, not an exception** — the same
  call as milk's duplicate slot. `createCropCycle` and
  `createHarvestRecord` catch `P2003` and return `unknown-field` /
  `unknown-cycle`. Caught rather than pre-checked with a read: a
  read-then-write says nothing about the state at the moment of the
  insert, and the constraint does. The pickers only ever offer real
  rows, so this is about a forged POST, not the screen.
- **A harvest has no uniqueness constraint, and that is the point.**
  `MilkRecord` is one row per (date, session) by invariant 1; a crop
  cycle can be harvested twice in a day — a partial pick, then the rest
  — so `createHarvestRecord` is a plain insert. Two entries on one date
  are correct data. Getting this wrong in the other direction (copying
  milk's duplicate check across) would silently lose half a harvest.
- **`requireOwner()` lives in `lib/auth/roles.ts`, not `session.ts`.**
  `session.ts` imports Clerk's `auth()` at the top level, so it cannot
  load outside a request and anything in it can only be tested through a
  live session. `roles.ts` is pure and imports only a *type* from it, so
  the owner rule is verified directly against every gate state rather
  than asserted. This is not the role parameter `code-standards.md`
  forbids — that rule is about a query helper branching internally; this
  is the caller resolving its own identity before choosing a path.
- **The owner check runs before validation, not after.** Both `create*`
  actions call `requireOwner()` on the resolved gate as their first
  statement, so a worker's forged POST is refused before its input is
  parsed and before any row is read or written. `not-owner` is its own
  status so the message can state the rule rather than complain about a
  correctly filled field.
- **`Field` has no owner id to store.** The spec's signature named one,
  but `Field` is the single model in the schema with no `enteredById` —
  registry data, not a transactional record. The parameter is absent
  rather than accepted and dropped, which would read as attribution that
  is not happening. Open question 15 territory if a field ever needs an
  author.
- **`farmDate()` moved to `lib/db/dates.ts` when the second module
  needed it.** It sat in `milk.ts` while milk was the only date column;
  copying it into `land.ts` would have been the moment two civil-day
  definitions started drifting apart. `parseFarmDate()` joined it
  because `new Date("2026-02-31")` rolls silently into March and
  `new Date(string)` switches between UTC and local depending on whether
  a time is present — neither is acceptable at a form boundary.
- **`ChoiceGrid` was generalised out of `SessionToggle`, not copied.**
  The harvest unit picker is the same control as the session toggle, so
  the cells, radios and accent live in one component and
  `SessionToggle` became a thin wrapper. Its public API is unchanged.
  The accent is a lookup map rather than an interpolated class name,
  because Tailwind scans source text and never generates
  `peer-checked:bg-${accent}`.
- **A `Select` is right when the option set grows with the farm.**
  `ui-context.md` prefers full-width cells to a dropdown, and that still
  holds for units and sessions. A crop cycle picker is unbounded, so it
  gets a `Select` — sized `h-14` with a 2px edge so it still matches the
  row it sits in.
- **Module assignment is enforced, not decorative.** It arrived as a way
  to decide which links a worker is offered, which made it a suggestion:
  a worker narrowed to the shop could still type `/land` and log a
  harvest. `requireModule()` in `lib/auth/roles.ts` now guards the page
  read *and* the action write for all three modules, next to
  `requireOwner()` and with the same shape. Owners are never restricted,
  and an empty assignment still means all three — so the check refuses
  nobody today (verified: all four user rows have empty assignments) and
  starts mattering the moment an owner narrows someone, which is when
  they would expect it to. The "empty means all" rule lives in exactly
  one function, `isModuleAssigned()`, so the nav and the guard cannot
  drift apart.
- **`farmDate()` is idempotent.** It read a `Date` as an instant and
  took the civil day where the server stands, so applying it to a value
  that was already midnight UTC — what it and `parseFarmDate()` both
  return — shifted it a day west of Greenwich. `createCropCycle`
  normalised a date the action had already normalised, so on any server
  in the Americas every planting date would have been stored a day
  early, silently. A value already at exactly midnight UTC now passes
  through untouched. The local machine sits east of UTC, which is why
  neither the verification nor the browser ever showed it.
- **A Clerk account is not authorisation — access is default-deny.**
  Found in use, not in review: anyone could reach Clerk's hosted sign-up
  page (`<SignIn />` links to it), and the webhook then created them a
  live `WORKER` row. They set their own PIN and were in, with the milk
  screen, the harvest screen and the till. `architecture.md` had claimed
  that removing the in-app `/sign-up` route "closes the app's own front
  door"; it did not, and that line has been corrected rather than left
  to mislead the next reader.

  The webhook now creates `active: false` and the owner approves
  explicitly. The Clerk instance restriction is still worth setting —
  it stops unwanted accounts existing at all — but it is a single
  external toggle this codebase cannot read back or assert, so it is
  now the second line rather than the only one. **The fix is that the
  app stopped inferring authorisation from authentication.**
- **Revoking does not clear the PIN.** It writes `active` and nothing
  else. `resolveAuthGate()` refuses an inactive user before a PIN is
  ever checked, so a revoked worker's PIN is already inert — and
  `pinSetAt` is the only thing distinguishing a never-approved account
  from a revoked one. Wiping it would show every revoked worker
  "Waiting for approval", which is both wrong and an invitation to ask
  again.
- **Approve is one tap, revoke is two.** Approving grants access to
  someone the owner went looking for. Revoking cuts someone off
  mid-shift, so it takes the same two-tap confirm as the PIN reset
  beside it.
- **Invariant 4 is enforced by the database, not by application code.**
  `recordSale` decrements each line with a conditional `updateMany`
  carrying `quantity: { gte: requested }`, inside one transaction. The
  read and the write are a single statement holding a single row lock,
  so two tills cannot both see six bags and both sell four. Measured
  rather than assumed: ten concurrent sales of two units against ten in
  stock left **8** under the read-then-write version — nine of ten
  decrements lost — and exactly **0** under the conditional update, with
  five sales succeeding. That control is what makes the concurrency test
  meaningful rather than decorative.
- **A busy transaction is a typed result, not an exception.** The
  concurrency test surfaced a real defect: Prisma's default 5s
  interactive-transaction timeout was blown by ten simultaneous sales
  against a pooled remote Postgres, and the tenth failed with a raw
  `P2028` that escaped as an unhandled error. The budget is now
  `maxWait` 10s / `timeout` 20s, and a timeout that still happens comes
  back as `{ ok: false, reason: "busy" }` — "ring it again" is something
  a worker at a till can act on, a stack trace is not. Nothing is
  written when it happens, so a retry is safe. **This is the argument
  for testing concurrency rather than sequences: nothing sequential
  would ever have shown it.**
- **A till never names its own price.** `recordSale` reads each price
  from the stock row *inside* the transaction; the client sends item ids
  and quantities and nothing else. A price that crossed the wire could
  be edited to zero. It also means a later price change cannot rewrite
  what was already sold — verified by repricing an item to 99.00 and
  confirming the existing `SaleItem` stayed at 12.50.
- **`getStockItemsForSale()` is a documented carve-out from invariant
  2, not a breach of it.** A till cannot ring a sale without a price,
  and the worker is reading that price to the customer as they serve
  them. What the invariant protects is cost, margin and revenue — none
  of which appear there, and nothing in it aggregates. Recorded in
  `architecture.md` inside invariant 2 itself, so the next reader finds
  the reasoning where they find the rule, rather than discovering a safe
  export with a price on it and assuming the rule had rotted.
- **`ChoiceGrid` was *not* reused for the item grid.** The spec said to
  reuse it if it fits; it does not. `ChoiceGrid` is a radio group — one
  exclusive value with a checked state — and a till's item grid is a row
  of actions that each add to a running cart, with no selection at all.
  Bending one component to do both would have needed a mode flag that
  makes every existing caller read worse, which is forking under another
  name. `QuantityStepper` *is* reused, on each cart line, where the
  shape genuinely matches.
- **Duplicate sale lines are merged before anything is written.** Two
  lines of three for one item would otherwise be checked against stock
  separately, and both could pass while the pair does not. Merging first
  means one decrement per item, so the conditional update guards the
  whole quantity at once.
- **An unknown item is its own reason.** A conditional update matches no
  rows both when stock is short and when the item does not exist.
  Reporting "not enough stock" for something that was never stocked
  sends a worker to count a shelf that isn't there, so the items are
  read first and a missing one returns `unknown-item`.
- **The cart is not persisted.** An interrupted cash sale is re-rung,
  which is what happens at a till anyway; persisting a half-finished
  sale would leave stock ambiguously committed with nothing to release
  it.
- **Money is formatted without a currency symbol.** Nothing in the
  context files names a currency (open question 20), and a symbol on
  every price tag is exactly the sort of invented product fact
  `ai-workflow-rules.md` forbids. `formatCents` groups and fixes to two
  decimals; naming the currency later is a one-line change.
- **The owner's home is one module, not the dashboard.** The spec was
  explicit and it is the right call: a three-module dashboard built now
  would have two cards reading from modules with no write path. The
  owner's "Worker PINs" section stays on that page, because removing it
  would take away the only route out of a forgotten PIN.

## Session Notes

- Next.js here is 16.x — conventions differ from older App Router
  versions. Consult `node_modules/next/dist/docs/` before writing
  framework code.
- The shadcn CLI is interactive by default; `init` needs an explicit
  `-b <base>` and `-p <preset>` to run unattended.
- `next dev` rewrites the `nextjs-agent-rules` block in `AGENTS.md`;
  committing that change alongside real work keeps the tree clean.
- `--font-sans` is declared in an **unlayered** `:root` block in
  `app/globals.css`, which is what makes it win over the
  self-referential `--font-sans: var(--font-sans)` Tailwind emits into
  `@layer theme`. Don't move that block inside a layer.
- Prisma 7 does not read `.env` on its own — hence the `dotenv` import at
  the top of `prisma.config.ts`. Next.js still loads `.env` for the app
  itself, so the runtime client needs nothing extra.
- `prisma skills sync` (from the v8 CLI) scatters agent instruction files
  into `.claude/`, `.cursor/`, `.agents/` and `.devin/`. They describe
  Prisma 8 and were removed; don't run it while the project is on 7.x.
- Verifying a server-only module outside Next.js needs
  `npx tsx --conditions=react-server`, otherwise `import "server-only"`
  throws by design.
- `prisma migrate dev` does **not** regenerate the client in Prisma 7 —
  run `npx prisma generate` after a migration or `tsc` will still be
  typing the old schema.
- Prisma's interactive transactions default to `maxWait` 2s and
  `timeout` 5s, and both are easy to exceed against a pooled remote
  Postgres the moment two writers contend for the same row. The failure
  is `P2028`, and it arrives as a thrown error rather than anything
  typed. If a transaction holds a lock across more than a couple of
  round trips, set the budget explicitly and handle `P2028`.
- **Restart `next dev` after a migration, too.** Regenerating is not
  enough for an already-running dev server: it fails with
  `PrismaClientValidationError — Unknown field 'x' for select statement`
  while a fresh `tsx` process, `tsc` and `next build` all pass on the
  same code. The cause is the `globalThis` cache in `lib/db/client.ts`,
  which exists so hot reload cannot leak connection pools. Hot reload
  re-evaluates the module, but `globalForPrisma.prismaClient ?? …` hands
  back the instance built from the *previous* generation, and that
  instance still carries the old schema. Nothing in the code is wrong
  when this happens — only the process is stale. This is the trade-off
  of that cache, and it will recur on every schema change.
- Moving a page between folders leaves a stale `.next/dev/types/`
  validator behind that fails `next build` with a missing-module error.
  `rm -rf .next/dev` clears it.
- `verifyWebhook` from `@clerk/nextjs/webhooks` types its parameter as
  `NextRequest`, so a route handler taking a plain `Request` does not
  typecheck.
- To deliver Clerk webhooks to localhost: `clerk webhooks listen
  --forward-to http://localhost:3000/api/webhooks/clerk`, then put the
  signing secret it prints into `CLERK_WEBHOOK_SIGNING_SECRET`.
- A Postgres `date` column round-trips through Prisma as **midnight
  UTC**. Build it with `Date.UTC(...)` and format it back with
  `timeZone: "UTC"`, or a server west of Greenwich renders every entry
  a day early. `farmDate()` is the only place that conversion happens.
- `zod` 4 renamed the error options: it is `z.number({ error: "…" })`
  now, not `invalid_type_error` / `required_error`. `z.enum()` also
  accepts Prisma's generated enum object directly, so the action's
  schema follows `schema.prisma` instead of restating it, and it takes a
  plain `as const` array for a set the schema doesn't define (harvest
  units). `.refine()` on an object is how a cross-field rule is written
  — an expected harvest date not preceding its planting date.
- Anything importing `lib/auth/session.ts` cannot be run under
  `npx tsx --conditions=react-server`: Clerk's `auth()` pulls in Next's
  client router context, which fails with
  `React.createContext is not a function`. That is what forced
  `requireOwner()` into its own module — and it is the general rule for
  anything that needs testing outside a request.
- A Clerk CLI link derived from the **git remote** overrides
  `CLERK_SECRET_KEY` in `.env`, so the CLI can silently operate on a
  different instance than the running app while `clerk doctor` stays
  green. `clerk whoami` is the tell: `localSecretKeySource: null` means
  a link is winning. `clerk unlink` hands control back to `.env`.
