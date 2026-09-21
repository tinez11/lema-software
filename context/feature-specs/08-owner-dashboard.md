Read `Agents.md` before starting

Were building the three-module owner dashboard — unblocked now that
all three modules have real data. This unit also fixes a routing gap
it exposes: extracting milk out of `app/(app)/page.tsx` reveals that a
worker assigned only `LAND` or only `SHOP` currently still lands on
the milk screen regardless, because `/` has always hardcoded it.

Extract the existing Cows & Milk screen (currently rendered inline at
`/`) into its own `app/(app)/milk/page.tsx`, mirroring `/land` and
`/shop`. Move the components; do not duplicate them.

Rewrite `app/(app)/page.tsx` to branch on role:
- `OWNER` → the dashboard built in this unit.
- `WORKER` → redirect to the first module in
  `modulesFor(user.assignedModules)` (the same registry-order function
  `module-nav.tsx` already uses: MILK, LAND, SHOP). This is the actual
  fix — today's hardcoded milk screen is replaced by routing that
  respects the assignment that already exists in the schema.

Add read helpers:
- `getTodayMilkTotal()` in `lib/db/milk.ts` — a plain quantity sum, no
  financial concern.
- `getRecentHarvestSummary()` in `lib/db/land.ts` — quantity only.
  `InputRecord` and cost-vs-yield are still out of scope (Next Up #3),
  so this card shows activity, not money, until that lands.
- `getTodaySalesSummary()` / `getTodaySalesSummaryWithFinancials()` in
  `lib/db/shop.ts` — count is safe, revenue is privileged, same split
  as everything else financial.
- `getLowStockAlerts()` in `lib/db/shop.ts` — quantity and threshold
  only, no price, so this is a plain safe export despite living next
  to financial ones.

Add `components/farm/metric-card.tsx` (module-accented, reusable
across the three cards) and `components/farm/needs-attention-list.tsx`.
The needs-attention list is scoped to what has a real data source
today — low-stock shop items only. Do not invent a milk or land alert
with nothing behind it; those arrive with the health-reminder and
cost-vs-yield units later.

Layout the grid responsively per the decision above: single column
below the breakpoint, multi-column above it. No sidebar.

Drop the `--sidebar-*` tokens from `app/globals.css` — nothing uses
them and nothing in this unit introduces a sidebar.

The existing "Worker PINs" section stays on this page, below the
dashboard content, unchanged — it's still the only recovery route for
a forgotten PIN, and this is where open question 19's future
assignment control belongs too, not part of this unit.

Do not build `InputRecord` or cost-vs-yield reporting. Do not build
the worker-module-assignment control. If `07-module-nav-separation.md`
hasn't landed, treat it as a prerequisite for the worker's screens, not
part of this unit — this spec only touches the owner's `/`.

Do not modify `components/ui/*`.

### Check when done
- The owner reaches milk content at `/milk`, unchanged in substance
  from before; `GET /` for the owner now renders the dashboard instead
- A worker assigned only `LAND` (or only `SHOP`) lands directly on that
  module at `/`, not on the milk screen
- The metric grid is visibly multi-column at a desktop width and
  single-column at a phone width — check both, not just one
- The Land card shows a quantity, never a cost or yield-value figure
- The Shop card's revenue comes from the privileged helper; the safe
  count-only helper is what any non-owner code path would get, even
  though nothing non-owner reads this page
- The needs-attention list shows real low-stock items and nothing
  fabricated for milk or land
- No `Decimal` appears anywhere in the dashboard page's rendered payload
- `npm run build` passes
- `npm run lint` passes