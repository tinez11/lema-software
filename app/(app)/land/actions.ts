"use server"

import { InputType } from "@prisma/client"
import { refresh } from "next/cache"
import { z } from "zod"

import { requireModule, requireOwner } from "@/lib/auth/roles"
import { resolveAuthGate } from "@/lib/auth/session"
import { farmDate, parseFarmDate } from "@/lib/db/dates"
import {
  createCropCycle,
  createField,
  createHarvestRecord,
  createInputRecord,
} from "@/lib/db/land"
import {
  HARVEST_UNITS,
  MAX_FIELD_ACRES,
  MAX_HARVEST_QUANTITY,
  MAX_INPUT_COST_CENTS,
  MAX_INPUT_QUANTITY,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MIN_HARVEST_QUANTITY,
  roundInputQuantity,
  roundQuantity,
} from "@/lib/land-config"

// The write path for Land & Produce, following `milk/actions.ts` exactly:
// resolve the caller through `resolveAuthGate()`, validate with `zod`, call a
// query helper, `refresh()` on success. No action takes a user id.
//
// What is different here is that two of the three writes are owner-only.
// Setting up fields and crop cycles is registry work; logging a harvest
// against one is the daily job, and either role does that.
//
// `createInputRecordAction` is the one write here that touches money, and it is
// owner-only for that reason (invariant 2). The amount arrives from the client
// as integer cents — never a float of whole units, never a string — and
// `createInputRecord` converts it with `fromCents()` on the way into the
// column: see `lib/db/money.ts`. No cost is ever returned by this file.

const nameSchema = z
  .string()
  .trim()
  .min(1, "Give it a name.")
  .max(MAX_NAME_LENGTH, `Keep the name under ${MAX_NAME_LENGTH} characters.`)

/**
 * An empty optional text box arrives as `""`, which is not the same as "not
 * given". Both become `null` so the column holds one absence, not two.
 */
const optionalNoteSchema = z
  .string()
  .trim()
  .max(MAX_NOTE_LENGTH, `Keep the note under ${MAX_NOTE_LENGTH} characters.`)
  .optional()
  .transform((value) => (value ? value : null))

const optionalAcresSchema = z
  // A typed-in size arrives via `Number()`, so a stray letter reaches here as
  // NaN. The custom message means that reads as "not a number of acres"
  // rather than zod's default type complaint.
  .number({ error: "Size has to be a number of acres." })
  .positive("Size has to be more than zero acres.")
  .max(MAX_FIELD_ACRES, `That's over ${MAX_FIELD_ACRES} acres — check it.`)
  .nullish()
  .transform((value) => value ?? null)

const dateStringSchema = z
  .string()
  .refine((value) => parseFarmDate(value) !== null, "That isn't a real date.")
  .transform((value) => parseFarmDate(value) as Date)

const createFieldSchema = z.object({
  name: nameSchema,
  sizeAcres: optionalAcresSchema,
  locationNote: optionalNoteSchema,
})

const createCropCycleSchema = z
  .object({
    fieldId: z.string().min(1, "Pick a field."),
    cropType: nameSchema,
    plantingDate: dateStringSchema,
    expectedHarvestDate: dateStringSchema.nullish().transform((v) => v ?? null),
  })
  .refine(
    (value) =>
      !value.expectedHarvestDate ||
      value.expectedHarvestDate >= value.plantingDate,
    {
      error: "The expected harvest can't be before the planting date.",
      path: ["expectedHarvestDate"],
    }
  )

const createInputRecordSchema = z.object({
  cropCycleId: z.string().min(1, "Pick a crop cycle."),
  type: z.enum(InputType),
  // Nullable because the column is: a lump purchase or an hour of labour can
  // carry a cost and no meaningful count. An empty box is "not given", not
  // zero, the same way a field's acreage is.
  quantity: z
    .number({ error: "Quantity has to be a number." })
    .positive("Quantity has to be more than zero.")
    .max(MAX_INPUT_QUANTITY, "That quantity is too large — check it.")
    .nullish()
    .transform((value) => value ?? null),
  // Whole cents, and checked to be whole here rather than left to throw inside
  // `fromCents()`: a forged POST carrying 12.5 cents should come back as a
  // typed `invalid`, not as a 500.
  costCents: z
    .number({ error: "Enter what it cost." })
    .int("Cost has to be a whole number of cents.")
    // Zero is allowed. `InputRecord.cost` is not nullable, so zero is the only
    // way to record an input that cost no cash — own-saved seed, or family
    // labour — and refusing it would mean the entry could not be made at all.
    .min(0, "Cost can't be negative.")
    .max(MAX_INPUT_COST_CENTS, "That cost is too large — check the decimal."),
})

const logHarvestSchema = z.object({
  cropCycleId: z.string().min(1, "Pick a crop cycle."),
  quantity: z
    .number({ error: "Enter the quantity harvested." })
    .min(MIN_HARVEST_QUANTITY, `Log at least ${MIN_HARVEST_QUANTITY}.`)
    .max(
      MAX_HARVEST_QUANTITY,
      `That's over ${MAX_HARVEST_QUANTITY} — check the reading.`
    ),
  unit: z.enum(HARVEST_UNITS),
})

export type CreateFieldInput = z.input<typeof createFieldSchema>
export type CreateCropCycleInput = z.input<typeof createCropCycleSchema>
export type CreateInputRecordInput = z.input<typeof createInputRecordSchema>
export type LogHarvestInput = z.input<typeof logHarvestSchema>

/**
 * `not-owner` is deliberately its own status, distinct from `invalid`: a
 * worker who somehow reaches these actions should be told the rule, not handed
 * a validation message about a field they filled in correctly.
 */
export type CreateFieldResult =
  | { status: "ok"; name: string }
  | { status: "not-owner" }
  | { status: "invalid"; message: string }
  | { status: "not-allowed" }

export type CreateCropCycleResult =
  | { status: "ok"; cropType: string }
  | { status: "not-owner" }
  | { status: "unknown-field" }
  | { status: "invalid"; message: string }
  | { status: "not-allowed" }

/**
 * `ok` carries the type back and nothing about the cost. The form already
 * holds the amount it sent, so echoing it would be a second copy of a money
 * value crossing the boundary for no reason.
 */
export type CreateInputRecordResult =
  | { status: "ok"; type: InputType }
  | { status: "not-owner" }
  | { status: "unknown-cycle" }
  | { status: "invalid"; message: string }
  | { status: "not-allowed" }

export type LogHarvestResult =
  | { status: "ok"; quantity: number; unit: string }
  | { status: "unknown-cycle" }
  | { status: "invalid"; message: string }
  | { status: "not-allowed" }
  | { status: "not-assigned" }

/**
 * The first validation message from a failed parse.
 *
 * One message, not all of them: these forms are read on a phone, and a stack
 * of complaints under a small screen is worse than the first thing to fix.
 */
function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "That entry doesn't look right."
}

/** Owner-only: registers a field. */
export async function createFieldAction(
  input: CreateFieldInput
): Promise<CreateFieldResult> {
  const caller = requireOwner(await resolveAuthGate())

  if (!caller.ok) return { status: caller.status }

  const parsed = createFieldSchema.safeParse(input)

  if (!parsed.success) {
    return { status: "invalid", message: firstIssue(parsed.error) }
  }

  const field = await createField(
    parsed.data.name,
    parsed.data.sizeAcres,
    parsed.data.locationNote
  )

  refresh()

  return { status: "ok", name: field.name }
}

/** Owner-only: opens a crop cycle on a field. Status stays `PLANNED`. */
export async function createCropCycleAction(
  input: CreateCropCycleInput
): Promise<CreateCropCycleResult> {
  const caller = requireOwner(await resolveAuthGate())

  if (!caller.ok) return { status: caller.status }

  const parsed = createCropCycleSchema.safeParse(input)

  if (!parsed.success) {
    return { status: "invalid", message: firstIssue(parsed.error) }
  }

  const result = await createCropCycle(
    parsed.data.fieldId,
    parsed.data.cropType,
    parsed.data.plantingDate,
    parsed.data.expectedHarvestDate,
    caller.user.id
  )

  if (!result.ok) return { status: "unknown-field" }

  refresh()

  return { status: "ok", cropType: result.cycle.cropType }
}

/**
 * Owner-only: logs what went into a cycle and what it cost.
 *
 * The owner check is the first statement, before the input is parsed — so a
 * worker's forged POST is refused without a cost ever being read, validated or
 * written, and `not-owner` comes back distinct from `invalid`. This is the
 * money-bearing write in the module, so that ordering is invariant 2 at the
 * write end rather than a courtesy.
 *
 * Like the harvest action, the date is derived on the server: every screen here
 * logs today, and `createInputRecord` still takes one for the backdating and
 * sync paths that come later.
 */
export async function createInputRecordAction(
  input: CreateInputRecordInput
): Promise<CreateInputRecordResult> {
  const caller = requireOwner(await resolveAuthGate())

  if (!caller.ok) return { status: caller.status }

  const parsed = createInputRecordSchema.safeParse(input)

  if (!parsed.success) {
    return { status: "invalid", message: firstIssue(parsed.error) }
  }

  const result = await createInputRecord(
    parsed.data.cropCycleId,
    farmDate(),
    parsed.data.type,
    parsed.data.quantity === null
      ? null
      : roundInputQuantity(parsed.data.quantity),
    parsed.data.costCents,
    caller.user.id
  )

  if (!result.ok) return { status: "unknown-cycle" }

  refresh()

  return { status: "ok", type: result.record.type }
}

/**
 * Either role: logs a harvest against a cycle.
 *
 * The date is derived on the server, as it is for milk — every screen in this
 * unit logs today. `createHarvestRecord` still takes one, for the backdating
 * and sync paths that come later.
 */
export async function logHarvestAction(
  input: LogHarvestInput
): Promise<LogHarvestResult> {
  // The two `create*` actions above need no module check: `requireOwner`
  // already guarantees an owner, and owners are never module-restricted.
  const caller = requireModule(await resolveAuthGate(), "LAND")

  if (!caller.ok) return { status: caller.status }

  const parsed = logHarvestSchema.safeParse(input)

  if (!parsed.success) {
    return { status: "invalid", message: firstIssue(parsed.error) }
  }

  const quantity = roundQuantity(parsed.data.quantity)

  const result = await createHarvestRecord(
    parsed.data.cropCycleId,
    farmDate(),
    quantity,
    parsed.data.unit,
    caller.user.id
  )

  if (!result.ok) return { status: "unknown-cycle" }

  refresh()

  return { status: "ok", quantity, unit: result.record.unit }
}
