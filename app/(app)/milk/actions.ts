"use server"

import { MilkSession } from "@prisma/client"
import { refresh } from "next/cache"
import { z } from "zod"

import { resolveAuthGate } from "@/lib/auth/session"
import { farmDate } from "@/lib/db/dates"
import { createMilkRecord, updateMilkRecord } from "@/lib/db/milk"
import { getUserById } from "@/lib/db/users"
import {
  MAX_MILK_LITERS,
  MIN_MILK_LITERS,
  roundLiters,
} from "@/lib/milk-config"

// The write path for the Cows & Milk entry screen.
//
// A server action is a POST endpoint reachable by anyone who can send the
// request, not just by the screen that renders the form, so each one here
// re-resolves the caller through `resolveAuthGate()` and validates its input
// before touching `lib/db/`. No action takes a user id: the only identity that
// counts is the one Clerk answers with. Ownership and the same-day rule are
// enforced a second time inside `updateMilkRecord` itself.
//
// Nothing in this file touches money: `MilkRecord` has no financial column.
// The modules that do have one send integer cents and convert with
// `fromCents()` before the query — see `lib/db/money.ts`.

const sessionSchema = z.enum(MilkSession)

const litersSchema = z
  .number({ error: "Enter the liters collected." })
  .min(MIN_MILK_LITERS, `Log at least ${MIN_MILK_LITERS} L.`)
  .max(MAX_MILK_LITERS, `That's over ${MAX_MILK_LITERS} L — check the reading.`)

const logMilkSchema = z.object({
  session: sessionSchema,
  liters: litersSchema,
})

const editMilkSchema = z.object({
  id: z.string().min(1),
  liters: litersSchema,
})

export type LogMilkInput = z.input<typeof logMilkSchema>
export type EditMilkInput = z.input<typeof editMilkSchema>

export type LogMilkResult =
  | { status: "ok"; liters: number }
  | {
      status: "duplicate"
      existing: { liters: number; recordedByName: string }
    }
  | { status: "invalid"; message: string }
  | { status: "not-allowed" }

export type EditMilkResult =
  | { status: "ok"; liters: number }
  | { status: "not-yours" }
  | { status: "too-old" }
  | { status: "invalid"; message: string }
  | { status: "not-allowed" }

/** The first validation message, which is the one worth showing on a phone. */
function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "That entry doesn't look right."
}

/**
 * Logs today's herd total for one session.
 *
 * The date is derived on the server rather than accepted from the client:
 * every screen in this unit logs today, and a client-supplied date would let a
 * caller write into a slot the same caller is then not allowed to edit.
 * `createMilkRecord` still takes a date, for the backdating and sync paths
 * that come later.
 */
export async function logMilkAction(
  input: LogMilkInput
): Promise<LogMilkResult> {
  const gate = await resolveAuthGate()

  if (gate.state !== "ready") return { status: "not-allowed" }

  const parsed = logMilkSchema.safeParse(input)

  if (!parsed.success) {
    return { status: "invalid", message: firstIssue(parsed.error) }
  }

  const liters = roundLiters(parsed.data.liters)

  const result = await createMilkRecord(
    farmDate(),
    parsed.data.session,
    liters,
    gate.user.id
  )

  if (!result.ok) {
    // The slot is taken. Who took it is the useful half of the message — on
    // the owner's screen it is usually someone else — so the name is looked
    // up here rather than leaving the UI to say "by someone".
    const recordedBy = await getUserById(result.existing.recordedById)

    return {
      status: "duplicate",
      existing: {
        liters: result.existing.liters,
        recordedByName: recordedBy?.name ?? "another user",
      },
    }
  }

  refresh()

  return { status: "ok", liters: result.record.liters }
}

/**
 * Corrects the liters on an entry. Succeeds only for the caller's own entry,
 * logged today — the rule itself lives in `updateMilkRecord`; this action
 * supplies the caller's identity and translates the verdict for the screen.
 */
export async function editMilkAction(
  input: EditMilkInput
): Promise<EditMilkResult> {
  const gate = await resolveAuthGate()

  if (gate.state !== "ready") return { status: "not-allowed" }

  const parsed = editMilkSchema.safeParse(input)

  if (!parsed.success) {
    return { status: "invalid", message: firstIssue(parsed.error) }
  }

  const liters = roundLiters(parsed.data.liters)

  const result = await updateMilkRecord(parsed.data.id, liters, gate.user.id)

  if (!result.ok) return { status: result.reason }

  refresh()

  return { status: "ok", liters: result.record.liters }
}
