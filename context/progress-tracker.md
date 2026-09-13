# Progress Tracker

## Current Phase

Phase 1 — core data entry. Phase 0 (design system, data layer, auth) is
complete and every check in all three of its specs was verified,
including the owner and worker flows walked end to end in a browser
against the live Clerk instance and Postgres.

The first write path — logging a milk entry — is built and verified at
the data and action layers. The browser walkthrough of that screen is
the one thing still outstanding; see "In Progress".

## Current Goal

Finish Phase 1: Cows & Milk end to end. `MilkRecord` is the simplest
shape and its `@@unique([date, session])` constraint is the invariant
most worth exercising early, so it went first. Land & Produce and Shop
get the same treatment next, and only then does the three-module owner
dashboard become buildable.

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

## In Progress

`04-milk-entry.md` is built and verified everywhere it can be without a
Clerk session. Two of its checks are browser work and are **not yet
done**:

1. The unique(date, session) constraint exercised **through the real
   UI** — log a session, then log it again, and confirm the screen says
   "already logged at N L by X" rather than crashing. The constraint
   itself is proven at the data layer; what is unproven is the message
   reaching the screen.
2. The same-day edit and its two refusals walked in the browser.

Also worth watching on that first walkthrough: the entry form and the
"logged today" list are server-rendered, and the actions call
`refresh()` to re-render them in the action's own response. If a saved
entry does not appear in the list without a manual reload, that is the
thing to look at first.

## Next Up

1. Finish the walkthrough above, then Land & Produce and Shop get their
   own write paths — same shape: `lib/db/` write helpers, an
   `app/(app)/<module>/actions.ts`, and the screens. Per
   `ai-workflow-rules.md`, Phase 3 (PowerSync offline sync) does not
   start until Phase 1 is complete.
2. The three-module owner dashboard — the metric card grid and the
   cross-module "needs attention" list — once all three modules can be
   written to. Building it against one module would leave two-thirds of
   it pointing at nothing.
3. The animal registry, health records and breeding records: the rest
   of Cows & Milk, deliberately left out of the milk write path because
   they neither block it nor share it.

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
6. **`Decimal` across the server/client boundary.** Cost, price, and
   `totalAmount` come back as Prisma `Decimal` objects, which are not
   serialisable into a client component. Settle on one conversion
   (string at the DTO boundary, most likely) before the first screen
   renders money.
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
  schema follows `schema.prisma` instead of restating it.
- A Clerk CLI link derived from the **git remote** overrides
  `CLERK_SECRET_KEY` in `.env`, so the CLI can silently operate on a
  different instance than the running app while `clerk doctor` stays
  green. `clerk whoami` is the tell: `localSecretKeySource: null` means
  a link is winning. `clerk unlink` hands control back to `.env`.
