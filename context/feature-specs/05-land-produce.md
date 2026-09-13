Read `Agents.md` before starting

Were adding the second write path: fields, crop cycles, and harvest
entries. `InputRecord` (the only cost-bearing model in this module) is
explicitly out of scope — see the note at the end.

Add to `lib/db/land.ts`:
- `createField(name, sizeAcres, locationNote, ownerId)` — owner only,
  checked by the caller via `resolveAuthGate()`, not by a role
  parameter on the helper.
- `createCropCycle(fieldId, cropType, plantingDate, expectedHarvestDate)`
  — owner only, same reason. Defaults `status: PLANNED`.
- `createHarvestRecord(cropCycleId, date, quantity, unit, recordedById)`
  — either role may call this. No uniqueness constraint applies here
  the way `@@unique([date, session])` does for milk: a crop cycle can
  legitimately be harvested more than once (a partial harvest, then the
  rest a few days later), so this is a plain insert, not a
  duplicate-checked one.
- `getCropCyclesForSelection()` — id, cropType, field name only, for
  populating a harvest form's picker. No dates, no status detail beyond
  what the picker needs.
- `getHarvestHistory(cropCycleId?)` — mirrors `getRecentMilkRecords`'s
  shape: the recorder joined as `{ id, name }` only, never `include`.

Do not build a CropCycle status-transition action (`PLANNED` →
`GROWING` → `HARVESTED`). A cycle's status stays whatever it was
created with for this unit; transitioning it manually is a small
follow-up once there's a reason to.

Add `app/(app)/land/actions.ts` — `createFieldAction`,
`createCropCycleAction`, `logHarvestAction`. Same pattern as
`milk/actions.ts`: resolve the caller through `resolveAuthGate()`,
validate with `zod`, `refresh()` on success. The two `create*` actions
additionally reject a non-owner caller before touching the database.

Add `lib/land-config.ts` for entry bounds (following `milk-config.ts`
and `pin-config.ts`): a sane quantity ceiling per harvest, shared by
the action and whatever input control the screen uses.

Route in `app/(app)/land/page.tsx`:
- Both roles see a harvest-logging form (crop cycle picker + quantity +
  unit) and a harvest history list.
- Only the owner sees the field/crop-cycle setup controls (a plain form
  to create each, no dedicated management screen yet).

Do not build `InputRecord`, cost entry, or any cost-vs-yield reporting
in this unit. That is the module's only money-bearing piece, and it
forces open question #6 (Decimal serialization at the server/client
boundary) — which Shop will need answered too. Answer it once, in
whichever of those two units gets built next, not here.

Do not modify `components/ui/*`.

### Check when done
- A worker can create a `Field` or `CropCycle`? — No: both attempts are
  rejected before any write happens, with a typed reason distinguishing
  "you're not the owner" from any validation failure.
- An owner creates a `Field`, then a `CropCycle` against it, then either
  role logs a `HarvestRecord` against that cycle.
- Two harvest entries against the same crop cycle on the same day both
  succeed (this module has no uniqueness constraint to enforce).
- The harvest history list shows entries from more than one recorder,
  joined as `{ id, name }` only.
- `npm run build` passes
- `npm run lint` passes