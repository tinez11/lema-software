"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { requireOwner } from "@/lib/auth/roles"
import { resolveAuthGate } from "@/lib/auth/session"
import { farmDate, parseFarmDate } from "@/lib/db/dates"
import {
  createCropCycle,
  createField,
  createHarvestRecord,
} from "@/lib/db/land"
import {
  HARVEST_UNITS,
  MAX_FIELD_ACRES,
  MAX_HARVEST_QUANTITY,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MIN_HARVEST_QUANTITY,
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
// Nothing in this file touches a `Decimal`. `InputRecord` — the module's only
// money-bearing model — is deliberately out of this unit, so open question 6
// stays open for whichever of Land's cost entry or Shop gets built next.

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

export type LogHarvestResult =
  | { status: "ok"; quantity: number; unit: string }
  | { status: "unknown-cycle" }
  | { status: "invalid"; message: string }
  | { status: "not-allowed" }

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
 * Either role: logs a harvest against a cycle.
 *
 * The date is derived on the server, as it is for milk — every screen in this
 * unit logs today. `createHarvestRecord` still takes one, for the backdating
 * and sync paths that come later.
 */
export async function logHarvestAction(
  input: LogHarvestInput
): Promise<LogHarvestResult> {
  const gate = await resolveAuthGate()

  if (gate.state !== "ready") return { status: "not-allowed" }

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
    gate.user.id
  )

  if (!result.ok) return { status: "unknown-cycle" }

  refresh()

  return { status: "ok", quantity, unit: result.record.unit }
}
