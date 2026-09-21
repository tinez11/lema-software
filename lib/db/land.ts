import "server-only"

import { Prisma } from "@prisma/client"
import type {
  CropCycle,
  CropCycleStatus,
  Field,
  HarvestRecord,
  InputType,
} from "@prisma/client"

import { prisma } from "./client"
import { farmDate } from "./dates"
import { fromCents, toCents } from "./money"
import { roundQuantity } from "../land-config"

// Thin read helpers for Land & Produce: the field registry, crop cycles, and
// the input/harvest records attached to a cycle.
//
// Input cost is owner-only (architecture.md, invariant 2). The plainly named
// helpers below select their columns explicitly and leave `cost` out; the
// `...WithFinancials()` variants return it and may only be called once the
// caller has verified `role === OWNER`.

/** Every InputRecord column except `cost`. */
const inputRecordSafeSelect = {
  id: true,
  clientId: true,
  cropCycleId: true,
  date: true,
  type: true,
  quantity: true,
  deviceId: true,
  createdAt: true,
  updatedAt: true,
  recordedById: true,
} satisfies Prisma.InputRecordSelect

// ───────────── Fields and cycles (no financial columns) ─────────────

/** The field registry, alphabetically. Reference data — small and unpaged. */
export function getFields() {
  return prisma.field.findMany({ orderBy: { name: "asc" } })
}

/** One field, or null. */
export function getFieldById(id: string) {
  return prisma.field.findUnique({ where: { id } })
}

/**
 * Crop cycles, newest planting first. Narrow by field, by status, or both.
 *
 * Note nothing in the app moves a cycle off `PLANNED` yet, so filtering by
 * `GROWING` or `HARVESTED` returns nothing today — see open question 17.
 */
export function getCropCycles(
  options: { fieldId?: string; status?: CropCycleStatus } = {}
) {
  const { fieldId, status } = options

  return prisma.cropCycle.findMany({
    where: {
      ...(fieldId ? { fieldId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { plantingDate: "desc" },
  })
}

/** One crop cycle, or null. */
export function getCropCycleById(id: string) {
  return prisma.cropCycle.findUnique({ where: { id } })
}

/**
 * Just enough to fill a harvest form's picker: what to call each cycle and
 * which field it is in. No dates, no status — a form that only has to identify
 * a cycle has no business reading the rest of it, and this keeps the payload
 * small on a phone.
 *
 * The cost is that two cycles of the same crop in the same field read
 * identically in the picker. That cannot happen yet — nothing closes a cycle,
 * so there is only ever one season's worth — but it is the first thing to fix
 * when status transitions land. See open question 17.
 */
const cropCycleForSelection = {
  id: true,
  cropType: true,
  field: { select: { name: true } },
} satisfies Prisma.CropCycleSelect

export type CropCycleForSelection = Prisma.CropCycleGetPayload<{
  select: typeof cropCycleForSelection
}>

/** Every cycle, in the minimal shape described above, for a form's picker. */
export function getCropCyclesForSelection(): Promise<CropCycleForSelection[]> {
  return prisma.cropCycle.findMany({
    select: cropCycleForSelection,
    orderBy: [{ plantingDate: "desc" }, { cropType: "asc" }],
  })
}

// ───────────── Inputs ─────────────

/**
 * Seed, fertilizer, pesticide and labour entries for a cycle, newest first.
 * The safe path: its explicit select leaves `cost` out (invariant 2), so it
 * answers "what went in" but never "what it cost".
 */
export function getInputRecords(
  options: { cropCycleId?: string; take?: number } = {}
) {
  return prisma.inputRecord.findMany({
    where: options.cropCycleId ? { cropCycleId: options.cropCycleId } : undefined,
    select: inputRecordSafeSelect,
    orderBy: { date: "desc" },
    take: options.take,
  })
}

/**
 * Owner-only: includes the input cost, as `costCents`. Verify `role === OWNER`
 * before calling. Money leaves `lib/db/` as whole cents under a renamed key,
 * never as a `Decimal` — see `lib/db/money.ts`.
 */
export async function getInputRecordsWithFinancials(
  options: { cropCycleId?: string; take?: number } = {}
) {
  const records = await prisma.inputRecord.findMany({
    where: options.cropCycleId ? { cropCycleId: options.cropCycleId } : undefined,
    orderBy: { date: "desc" },
    take: options.take,
  })

  return records.map(({ cost, ...record }) => ({
    ...record,
    costCents: toCents(cost),
  }))
}

/**
 * Owner-only: total input cost for one cycle, in cents. Verify
 * `role === OWNER` first.
 *
 * A cycle with no inputs sums to 0 rather than null: "nothing spent yet" is
 * zero cost, and handing every caller a nullable number invites a `?? 0` that
 * one of them will forget.
 */
export async function sumInputCostWithFinancials(
  cropCycleId: string
): Promise<{ totalCents: number }> {
  const { _sum } = await prisma.inputRecord.aggregate({
    where: { cropCycleId },
    _sum: { cost: true },
  })

  return { totalCents: _sum.cost ? toCents(_sum.cost) : 0 }
}

export type CostVsYield = {
  totalCostCents: number
  harvestByUnit: { unit: string; quantity: number }[]
}

/**
 * Owner-only: what one cycle cost against what it produced. Verify
 * `role === OWNER` first.
 *
 * **No ratio.** The yield stays a list of per-unit quantities and is never
 * divided into the cost, because `HarvestRecord.unit` is one of
 * `HARVEST_UNITS` and a cycle picked in both kg and bags has no single blended
 * figure that means anything — the same reason `sumHarvestQuantity()` groups
 * instead of summing. A cost-per-unit computed only when one unit happens to
 * be present would also be a number that silently disappears the first time a
 * second unit is logged, which is worse than never offering it.
 *
 * So this is the comparison, not a computation of it: the money that went in,
 * beside the quantities that came out. Largest quantity first, matching
 * `getRecentHarvestSummary`, so a caller showing one line shows the unit that
 * dominated.
 */
export async function getCostVsYieldWithFinancials(
  cropCycleId: string
): Promise<CostVsYield> {
  const [cost, harvest] = await Promise.all([
    sumInputCostWithFinancials(cropCycleId),
    sumHarvestQuantity(cropCycleId),
  ])

  return {
    totalCostCents: cost.totalCents,
    harvestByUnit: harvest
      .map((row) => ({
        unit: row.unit,
        quantity: roundQuantity(row._sum.quantity ?? 0),
      }))
      .sort((a, b) => b.quantity - a.quantity),
  }
}

// ───────────── Harvests (quantities only, no financial columns) ─────────────

/**
 * Raw harvest rows, newest first — quantities only, no joins.
 *
 * `getHarvestHistory()` is what a screen usually wants: same rows, plus the
 * recorder and the crop they belong to. This one exists for callers that
 * already know the context and do not want to pay for the joins.
 */
export function getHarvestRecords(
  options: { cropCycleId?: string; take?: number } = {}
) {
  return prisma.harvestRecord.findMany({
    where: options.cropCycleId ? { cropCycleId: options.cropCycleId } : undefined,
    orderBy: { date: "desc" },
    take: options.take,
  })
}

/** Harvested quantity for one cycle, in the unit each record was logged in. */
export function sumHarvestQuantity(cropCycleId: string) {
  return prisma.harvestRecord.groupBy({
    by: ["unit"],
    where: { cropCycleId },
    _sum: { quantity: true },
  })
}

/**
 * Recent harvest activity, grouped by the unit each record was logged in.
 *
 * Grouped rather than summed because `HarvestRecord.unit` is one of
 * `HARVEST_UNITS` — kg, bags, crates, bunches — and adding 12 crates to 40 kg
 * produces a number that means nothing. `sumHarvestQuantity()` groups for the
 * same reason. Largest total first, so a caller showing one headline figure
 * shows the unit that dominated the period.
 *
 * Quantity only, and it stays that way now that cost exists: this is the
 * dashboard's farm-wide activity figure, and there is deliberately no
 * financial twin of it to forget to gate. Cost is read per cycle, by
 * `getCostVsYieldWithFinancials()` above, behind an owner check.
 */
export async function getRecentHarvestSummary(
  options: { from?: Date } = {}
): Promise<{
  totals: { unit: string; quantity: number }[]
  entries: number
}> {
  const where = options.from ? { date: { gte: options.from } } : undefined

  const [grouped, entries] = await Promise.all([
    prisma.harvestRecord.groupBy({
      by: ["unit"],
      where,
      _sum: { quantity: true },
    }),
    prisma.harvestRecord.count({ where }),
  ])

  return {
    totals: grouped
      .map((row) => ({
        unit: row.unit,
        quantity: roundQuantity(row._sum.quantity ?? 0),
      }))
      .sort((a, b) => b.quantity - a.quantity),
    entries,
  }
}

/**
 * The same shape `getRecentMilkRecords` returns: the record plus who logged it
 * and which cycle it belongs to, with the recorder selected as `{ id, name }`.
 * Never `include` — that would carry `pinHash` out of this directory and break
 * invariant 6.
 */
const harvestRecordWithContext = {
  id: true,
  cropCycleId: true,
  date: true,
  quantity: true,
  unit: true,
  qualityGrade: true,
  recordedById: true,
  createdAt: true,
  updatedAt: true,
  recordedBy: { select: { id: true, name: true } },
  cropCycle: { select: { cropType: true, field: { select: { name: true } } } },
} satisfies Prisma.HarvestRecordSelect

export type HarvestRecordWithContext = Prisma.HarvestRecordGetPayload<{
  select: typeof harvestRecordWithContext
}>

/** Recent harvests, newest first. Pass a cycle id to scope it to one crop. */
export function getHarvestHistory(
  cropCycleId?: string,
  options: { take?: number } = {}
): Promise<HarvestRecordWithContext[]> {
  return prisma.harvestRecord.findMany({
    where: cropCycleId ? { cropCycleId } : undefined,
    select: harvestRecordWithContext,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: options.take ?? 20,
  })
}

// ───────────── Writes ─────────────
//
// Creating a `Field` or a `CropCycle` is owner-only, and that check lives in
// `app/(app)/land/actions.ts` where the caller's identity is resolved — not as
// a role parameter here. `code-standards.md` forbids a helper that takes a
// role and branches on it; the two-export split that invariant 2 uses is for
// *columns*, and neither of these helpers returns a financial one, so there is
// nothing here to split. Logging a harvest is open to both roles.

/**
 * Registers a field.
 *
 * `Field` is the one model in the schema with no `enteredById` — it is
 * reference data, not a transactional record, so there is nothing to attribute
 * and no owner id to store. The spec's signature named one; it is absent here
 * rather than accepted and silently dropped, which would read as attribution
 * that isn't happening. See open question 15.
 */
export function createField(
  name: string,
  sizeAcres: number | null,
  locationNote: string | null
): Promise<Field> {
  return prisma.field.create({ data: { name, sizeAcres, locationNote } })
}

export type CreateCropCycleResult =
  | { ok: true; cycle: CropCycle }
  | { ok: false; reason: "unknown-field" }

/**
 * Opens a crop cycle on a field. Status is whatever the schema defaults to
 * (`PLANNED`) — nothing in this unit moves a cycle through GROWING or
 * HARVESTED, and a transition action is a deliberate follow-up.
 *
 * A `fieldId` that does not exist comes back typed rather than as a raw
 * foreign-key error. The picker only offers real fields, so this is about a
 * forged POST, not the screen.
 */
export async function createCropCycle(
  fieldId: string,
  cropType: string,
  plantingDate: Date,
  expectedHarvestDate: Date | null,
  enteredById: string
): Promise<CreateCropCycleResult> {
  try {
    return {
      ok: true,
      cycle: await prisma.cropCycle.create({
        data: {
          fieldId,
          cropType,
          plantingDate: farmDate(plantingDate),
          expectedHarvestDate: expectedHarvestDate
            ? farmDate(expectedHarvestDate)
            : null,
          enteredById,
        },
      }),
    }
  } catch (error) {
    if (!isMissingReference(error)) throw error

    return { ok: false, reason: "unknown-field" }
  }
}

/**
 * What an insert hands back. Not the `InputRecord` row: that carries `cost` as
 * a `Prisma.Decimal`, which is not serialisable into a client component, so the
 * write selects its way around it exactly as `createStockItem` does. The
 * caller already holds the cost it sent, in cents, and has no need to be told
 * it again in another form.
 */
export type CreatedInputRecord = {
  id: string
  type: InputType
  quantity: number | null
}

export type CreateInputRecordResult =
  | { ok: true; record: CreatedInputRecord }
  | { ok: false; reason: "unknown-cycle" }

/**
 * Logs what went into a cycle and what it cost. Owner-only, and that check
 * lives in `app/(app)/land/actions.ts` beside the two other owner-only writes
 * — this helper takes no role parameter, per `code-standards.md`.
 *
 * `costCents` arrives as whole cents and `fromCents()` converts it on the way
 * in, which is the only direction money is allowed to travel here.
 *
 * `quantity` is nullable because the column is: an hour of labour or a lump
 * purchase may have a cost and no meaningful count. It also has no unit
 * anywhere in the schema — see open question 25.
 *
 * A plain insert, like `createHarvestRecord`: nothing about an input is unique
 * per day, and buying fertilizer twice in a week is correct data.
 */
export async function createInputRecord(
  cropCycleId: string,
  date: Date,
  type: InputType,
  quantity: number | null,
  costCents: number,
  recordedById: string
): Promise<CreateInputRecordResult> {
  try {
    return {
      ok: true,
      record: await prisma.inputRecord.create({
        data: {
          cropCycleId,
          date: farmDate(date),
          type,
          quantity,
          cost: fromCents(costCents),
          recordedById,
        },
        select: { id: true, type: true, quantity: true },
      }),
    }
  } catch (error) {
    if (!isMissingReference(error)) throw error

    return { ok: false, reason: "unknown-cycle" }
  }
}

export type CreateHarvestRecordResult =
  | { ok: true; record: HarvestRecord }
  | { ok: false; reason: "unknown-cycle" }

/**
 * Logs a harvest against a cycle. A plain insert, deliberately: unlike
 * `MilkRecord`, nothing here is unique per day. A cycle can legitimately be
 * harvested more than once — a partial pick, then the rest a few days later —
 * so two entries on one date are correct data, not a duplicate to catch.
 */
export async function createHarvestRecord(
  cropCycleId: string,
  date: Date,
  quantity: number,
  unit: string,
  recordedById: string
): Promise<CreateHarvestRecordResult> {
  try {
    return {
      ok: true,
      record: await prisma.harvestRecord.create({
        data: {
          cropCycleId,
          date: farmDate(date),
          quantity,
          unit,
          recordedById,
        },
      }),
    }
  } catch (error) {
    if (!isMissingReference(error)) throw error

    return { ok: false, reason: "unknown-cycle" }
  }
}

/**
 * A foreign key pointing at a row that isn't there. Caught rather than
 * pre-checked with a read: a read-then-write says nothing about the state at
 * the moment of the insert, and the constraint does.
 */
function isMissingReference(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2003" || error.code === "P2025")
  )
}
