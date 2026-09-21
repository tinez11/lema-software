Read `Agents.md` before starting

Were adding Land's own money-bearing model — InputRecord — and the
cost-vs-yield reporting it feeds. Left out of `05-land-produce.md`
deliberately, because it forced open question 6; that's answered now
(integer cents), so this unlocks it.

Add to `lib/db/land.ts`:
- `createInputRecord(cropCycleId, type, quantity, costCents)` — owner
  only, gated the same way as `createField`/`createCropCycle`: the
  action checks `requireOwner()` first, the helper itself takes no role
  parameter. Converts `costCents` via `fromCents()` before the insert.
  Catches `P2003` and returns `{ ok: false, reason: "unknown-cycle" }`,
  same pattern as `createHarvestRecord`.
- `getInputRecords(cropCycleId)` — safe: type, quantity, date. No cost,
  no `costCents`.
- `getInputRecordsWithFinancials(cropCycleId)` — the privileged twin,
  adds `costCents`.
- `sumInputCostWithFinancials(cropCycleId)` — `{ totalCents }`. A cycle
  with no inputs returns `{ totalCents: 0 }`, never `null` — if this
  already exists from the open-question-6 verification work, build on
  it rather than duplicate it, but re-run the empty-cycle check either
  way.
- `getCostVsYieldWithFinancials(cropCycleId)` — combines the cost sum
  with `sumHarvestQuantity()`'s existing per-unit grouping into one
  owner-facing summary: `{ totalCostCents, harvestByUnit: [{ unit,
  quantity }] }`. Do not collapse `harvestByUnit` into a single
  cost-per-unit figure when more than one unit is present — a cycle
  harvested in both kg and bags has no single blended number that means
  anything, and inventing one would be exactly the kind of fabricated
  product fact `ai-workflow-rules.md` forbids. Show the cost total
  against the list of quantities, not a computed ratio.

Extend `lib/land-config.ts` with a cost ceiling per entry, following the
`milk-config.ts` / `shop-config.ts` precedent. Reuse the schema's
existing `InputType` enum for validation — same `z.enum()` pattern
already used for `MilkSession`.

Add `createInputRecordAction` to `app/(app)/land/actions.ts`:
`requireOwner()` first statement, then `zod`, then the helper, then
`refresh()`. Same shape as the two existing `create*` actions in this
file.

Add `components/farm/input-cost-form.tsx` — `ChoiceGrid` for
`InputType` (four fixed values, matching the existing rule that a small
fixed set gets `ChoiceGrid` and a growing one gets `Select`), a
quantity field, and a cost field entered as whole currency and
converted to cents at the boundary, the same way the shop's stock-item
form already does it. Add `components/farm/cost-vs-yield-summary.tsx`
— owner-only, rendered per crop cycle, using `formatCents()`.

On `/land`: the owner's Setup section gains "Log input cost" beside the
existing field/cycle actions; each crop cycle shows its cost-vs-yield
summary to the owner only, gated by the same `requireOwner()`/
`requireModule()` pattern already protecting the rest of the page, not
just hidden by CSS. Workers see nothing new.

Optionally, and separately: swap the dashboard's Land `metric-card` to
read from `getCostVsYieldWithFinancials` instead of the current
activity-only count, now that real data exists. This is a one-card,
low-effort change directly named as a benefit of this unit — but it's
fine to leave for its own pass if you'd rather not touch `08`'s output
in the same unit.

Do not touch `CropCycle` status transitions (`PLANNED` → `GROWING` →
`HARVESTED`) — still separately deferred.

Do not modify `components/ui/*`.

### Check when done
- A worker cannot create an `InputRecord`; the rejection happens before
  validation, mirroring the existing `create*` actions in this file
- An input record against an unknown crop cycle returns
  `unknown-cycle`, not a crash
- `sumInputCostWithFinancials` on a cycle with no inputs returns
  `{ totalCents: 0 }`
- `getInputRecords` never carries `cost` or `costCents`; only the
  `WithFinancials` twin does — checked both at compile time and at
  runtime, the same way invariant 2 was verified in `02-database`
- A crop cycle harvested in two different units shows both quantities
  separately in its cost-vs-yield summary, never a single computed
  blended figure
- No `Decimal` reaches a rendered payload anywhere in this unit
- `npm run build` passes
- `npm run lint` passes
