import "server-only"

import { Prisma } from "@prisma/client"
import type { MilkRecord, MilkSession } from "@prisma/client"

import { prisma } from "./client"
import { farmDate } from "./dates"

// Herd-total milk production. One record per date and session, guaranteed by
// the `@@unique([date, session])` constraint on `MilkRecord` — never per
// animal (architecture.md invariant 1).
//
// `MilkRecord` carries no financial columns, so there is one path per query
// here: no `...WithFinancials()` variant exists or is needed.

// ───────────── Reads ─────────────

export function getMilkRecords(
  options: { from?: Date; to?: Date; take?: number } = {}
) {
  const { from, to, take } = options

  return prisma.milkRecord.findMany({
    where: from || to ? { date: { gte: from, lte: to } } : undefined,
    orderBy: [{ date: "desc" }, { session: "asc" }],
    take,
  })
}

/** The single record occupying one date/session slot, if it exists. */
export function getMilkRecord(date: Date, session: MilkSession) {
  return prisma.milkRecord.findUnique({
    where: { date_session: { date: farmDate(date), session } },
  })
}

export function getMilkRecordByClientId(clientId: string) {
  return prisma.milkRecord.findUnique({ where: { clientId } })
}

/**
 * The record plus who logged it — and nothing else off the `User` row. An
 * `include` here would hand the caller `pinHash`, which invariant 6 says never
 * leaves this directory, so the relation is always selected, never included.
 */
const milkRecordWithRecorder = {
  id: true,
  date: true,
  session: true,
  liters: true,
  recordedById: true,
  createdAt: true,
  updatedAt: true,
  recordedBy: { select: { id: true, name: true } },
} satisfies Prisma.MilkRecordSelect

export type MilkRecordWithRecorder = Prisma.MilkRecordGetPayload<{
  select: typeof milkRecordWithRecorder
}>

/**
 * Everything logged on one day. Pass `recordedById` for a worker's own list —
 * a worker's "logged today" is scoped to their own entries, the owner's is not.
 */
export function getMilkRecordsForDate(
  date: Date,
  options: { recordedById?: string } = {}
): Promise<MilkRecordWithRecorder[]> {
  return prisma.milkRecord.findMany({
    where: {
      date: farmDate(date),
      ...(options.recordedById ? { recordedById: options.recordedById } : {}),
    },
    select: milkRecordWithRecorder,
    orderBy: { session: "asc" },
  })
}

/** Recent entries across every worker, newest day first. Owner-facing. */
export function getRecentMilkRecords(
  options: { take?: number } = {}
): Promise<MilkRecordWithRecorder[]> {
  return prisma.milkRecord.findMany({
    select: milkRecordWithRecorder,
    orderBy: [{ date: "desc" }, { session: "asc" }],
    take: options.take ?? 20,
  })
}

/** Total liters across both sessions over a date range. */
export function sumMilkLiters(options: { from?: Date; to?: Date } = {}) {
  return prisma.milkRecord.aggregate({
    where:
      options.from || options.to
        ? { date: { gte: options.from, lte: options.to } }
        : undefined,
    _sum: { liters: true },
  })
}

// ───────────── Writes ─────────────

export type CreateMilkRecordResult =
  | { ok: true; record: MilkRecord }
  | { ok: false; reason: "duplicate"; existing: MilkRecord }

/**
 * `MilkRecord` has exactly two unique constraints — `@@unique([date, session])`
 * and `clientId` — and nothing writes `clientId` until the PowerSync layer
 * lands, so a `P2002` from the create below can only be the date/session slot.
 * The `meta.target` check is there for when that stops being true: a driver
 * adapter reports the target as either the column list or the constraint name
 * (`MilkRecord_date_session_key`), and "date" appears in both.
 */
function isDuplicateSlot(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== "P2002") return false

  const target = error.meta?.target

  if (typeof target === "string") return target.includes("date")
  if (Array.isArray(target)) return target.includes("date")

  return true
}

/**
 * Claims one date/session slot for the herd total.
 *
 * The uniqueness constraint *is* invariant 1, so a second entry for a slot is
 * an ordinary outcome rather than an exception. It comes back as a typed
 * `duplicate` carrying the record that already holds the slot, so the screen
 * can say "already logged" instead of crashing on a raw `P2002`.
 */
export async function createMilkRecord(
  date: Date,
  session: MilkSession,
  liters: number,
  recordedById: string
): Promise<CreateMilkRecordResult> {
  const data = { date: farmDate(date), session, liters, recordedById }

  // Two attempts, because "someone else holds the slot" and "the slot is empty
  // again" are different races. If the row that tripped the constraint has
  // since been deleted the slot is free and the retry takes it; a second
  // failure with nothing there to point at is a real fault, not a duplicate.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return { ok: true, record: await prisma.milkRecord.create({ data }) }
    } catch (error) {
      if (!isDuplicateSlot(error)) throw error

      const existing = await getMilkRecord(data.date, session)

      if (existing) return { ok: false, reason: "duplicate", existing }
    }
  }

  const day = data.date.toISOString().slice(0, 10)

  throw new Error(
    `Could not settle the ${session} milk slot for ${day}: the record holding ` +
      `it kept disappearing between the write and the read.`
  )
}

export type UpdateMilkRecordResult =
  | { ok: true; record: MilkRecord }
  | { ok: false; reason: "not-yours" | "too-old" }

/**
 * Corrects the liters on an entry that has already been logged.
 *
 * This is where invariant 2's sibling rule — a worker edits only their own
 * recent entries — is actually enforced, and it lives here rather than in the
 * action so no future caller can reach the write without it. The record has to
 * belong to the caller, and it has to be today's.
 *
 * A record that does not exist comes back as `not-yours`, not a third reason:
 * a caller who may not edit an id has no business learning whether it is real,
 * and the UI only ever offers editing on entries it has just listed.
 *
 * Neither `recordedById` nor `date` is ever written after creation, so reading
 * the record and then updating it cannot race into the wrong verdict.
 */
export async function updateMilkRecord(
  id: string,
  liters: number,
  editingUserId: string
): Promise<UpdateMilkRecordResult> {
  const existing = await prisma.milkRecord.findUnique({
    where: { id },
    select: { recordedById: true, date: true },
  })

  if (!existing || existing.recordedById !== editingUserId) {
    return { ok: false, reason: "not-yours" }
  }

  if (existing.date.getTime() !== farmDate().getTime()) {
    return { ok: false, reason: "too-old" }
  }

  return {
    ok: true,
    record: await prisma.milkRecord.update({ where: { id }, data: { liters } }),
  }
}
