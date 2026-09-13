# Progress Tracker

## Current Phase

Phase 0 — Foundation. The design system, UI primitives, and the central
data layer (Prisma schema + `lib/db/`) are in place; auth is the last
piece before Phase 1.

## Current Goal

Close out Phase 0 with Clerk auth and the PIN-unlock layer, then move to
Phase 1 — core data entry for a single module, end to end.

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

## In Progress

Nothing — `01-design-system.md` and `02-database` are complete.

## Next Up

1. Clerk auth and the PIN-unlock layer in `lib/auth/` — the `input-otp`
   primitive is already in place for the PIN entry UI. `User.id` is the
   Clerk user id, so the two meet there.
2. Phase 1 — core data entry for one module end to end. This is where
   the write path lands: server actions plus the `lib/db/` write helpers
   they call. Per `ai-workflow-rules.md`, Phase 3 (PowerSync offline
   sync) does not start until Phase 1 is complete.
3. `components/farm/` composed components (metric cards, the "needs
   attention" list, quantity steppers) once there is real data to show.

## Open Questions

1. **Worker vs. owner visual treatment.** `ui-context.md` calls owner
   screens "softer, layered" and worker screens "flat and
   high-contrast", but the concrete difference (shadow, ring, spacing,
   type scale) isn't defined. Needs resolving in `ui-context.md`
   before module UI work starts.
2. **Primary action button size.** `ui-context.md` fixes the radius at
   16px but not the height or type scale of the dominant "Log milk" /
   "Checkout" button. The shadcn `lg` size is `h-9`, which is likely too
   small for outdoor one-handed use. Resolve before building
   `components/farm/`.
3. **App metadata.** `app/layout.tsx` still carries the create-next-app
   title and description. Left alone as out of scope for this spec;
   fix when the app shell is built.
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
8. **Production migration path.** `prisma migrate dev` is a development
   command and was used here against the shared Prisma Postgres
   instance. Deploys should run `prisma migrate deploy`; decide where
   that runs (CI step vs. release script) before anything is deployed.

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
