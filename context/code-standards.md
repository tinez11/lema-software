# Code Standards

## General

- Keep modules small and single-purpose. A component or route should
  map to exactly one of the three farm modules, or to a clearly
  cross-cutting concern (auth, sync, dashboard) — never a mix.
- Fix root causes. Don't patch around a sync conflict or a
  role-permission gap with a UI-only workaround; fix it at the data
  or API layer.
- Do not mix unrelated concerns — e.g., shop logic has no business
  living inside a Cows & Milk component, and vice versa.

## TypeScript

- Strict mode is required throughout the project.
- Avoid `any`. Prefer the types Prisma generates from `schema.prisma`
  over redefining shapes by hand.
- Validate all unknown external input (API request bodies, data
  arriving through sync) at the boundary before trusting it — use a
  schema validator such as `zod`.

## Next.js

- Default to server components. Add `"use client"` only where
  browser interactivity requires it (quantity steppers, live totals,
  the PIN-unlock switcher).
- Keep route handlers and server actions focused on a single
  responsibility — one action per record type, not a generic
  catch-all `update` endpoint.
- All Prisma access happens in server components, route handlers, or
  server actions — never in client-side code.

## Styling

- Use the CSS custom property tokens defined in `ui-context.md` — no
  hardcoded hex values in components.
- Follow the border-radius scale defined in `ui-context.md`.
- Light-only theme. Do not add dark-mode variants or branch on
  `prefers-color-scheme`.

## API Routes

- Validate and parse request input before any logic runs.
- Enforce Clerk auth and the owner/worker role check before any
  read or write that touches cost, price, or profit fields.
- Return consistent, predictable response shapes (`{ data }` or
  `{ error }`) across all routes.

## Data and Storage

- Metadata and transactional records belong in Postgres via Prisma.
- Photos belong in object storage; store only the URL in Postgres.
- Do not store large binary content directly in the database.

## File Organization

- `app/` — routed pages and layouts
- `components/ui/` — shadcn-generated primitives (protected)
- `components/farm/` — shared composed components across modules
- `lib/db/` — Prisma client and query functions
- `lib/sync/` — PowerSync client setup and sync rules
- `lib/auth/` — Clerk config and the PIN-unlock layer
