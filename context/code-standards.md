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
- Dispatch a write through `<form action={submit}>`, even where the
  values travel as React state rather than as `FormData`. React's action
  mechanism is what `useFormStatus()` reads, and that is how
  `components/farm/submit-button.tsx` knows it is pending without being
  handed a flag by every screen that uses it.
- Wrap that handler in `useSingleFlight` (`lib/use-single-flight.ts`).
  Disabling the button is what the user sees; the synchronous ref inside
  the hook is what makes a double tap **one** submission. `pending` is
  state, so two taps in one frame both read the value from before the
  first re-render, and Next then dispatches queued actions one after
  another rather than dropping the second — which on the till is a
  second sale.
- Repeat a form's readiness check inside its submit handler rather than
  leaving it to the button. A disabled submit button does not stop the
  Enter key submitting the form around it.

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
- Financial columns (`cost`, `unitPrice`, `subtotal`, `totalAmount`) are
  reachable only through a `...WithPricing()` / `...WithFinancials()`
  export. The plainly named helper beside it lists its columns with an
  explicit `select` that leaves them out, so a financial column added to
  `schema.prisma` later is excluded from the safe path by default.
- Never add a `role` parameter to a query helper and branch on it. The
  two paths are two exports; the caller picks one after checking the
  role, and `WithPricing`/`WithFinancials` is what an audit greps for.
- **Money leaves `lib/db/` as an integer number of cents, never as a
  `Decimal` and never as a float or a string.** A `Decimal` is not
  serialisable into a client component; a string cannot be arithmetic
  without being parsed back into a float, which is the precision problem
  the column exists to prevent, and the POS screen multiplies quantity
  by price on every tap. `toCents()` / `fromCents()` in `lib/db/money.ts`
  are the only place the conversion happens — reads convert on the way
  out, writes convert on the way back in.
- **A cents value is named for its unit**: `unitPriceCents`,
  `totalAmountCents`, `costCents`, `subtotalCents`. The suffix is not
  decoration — a bare `unitPrice: 1250` reads as 1,250 whole units to
  the next person, and money that is wrong by 100× is the kind of bug
  that reaches a customer.
- A `create*` helper for a model with a financial column passes an
  explicit `select` that leaves the column out of what it returns. The
  row would otherwise carry a `Decimal` that cannot cross into a client
  component, and the caller already holds the amount it sent.
- **Never divide a money total by a quantity whose unit is not fixed.**
  `getCostVsYieldWithFinancials()` reports the cost beside a list of
  per-unit quantities and never a cost per unit, because a cycle
  harvested in both kg and crates has no blended figure that means
  anything — and a ratio computed only when one unit happens to be
  present is a number that vanishes the first time a second one is
  logged.
- **Format only at final render.** Dividing by 100 to display is the
  last thing that happens to a number, never something done before
  storage or in the middle of a calculation. `fromCents()` throws on a
  fractional cent rather than rounding, because silently rounding money
  is how a till stops balancing.

## File Organization

- `app/` — routed pages and layouts
- `components/ui/` — shadcn-generated primitives (protected)
- `components/farm/` — shared composed components across modules
- `lib/db/` — Prisma client and query functions
- `lib/sync/` — PowerSync client setup and sync rules
- `lib/auth/` — Clerk config and the PIN-unlock layer
