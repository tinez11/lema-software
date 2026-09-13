import "server-only"

import type { MilkSession } from "@prisma/client"

import { prisma } from "./client"

// Thin read helpers for herd-total milk production. One record per date and
// session, guaranteed by the `@@unique([date, session])` constraint on
// `MilkRecord` — never per animal.

export function listMilkRecords(
  options: { from?: Date; to?: Date; take?: number } = {}
) {
  const { from, to, take } = options

  return prisma.milkRecord.findMany({
    where:
      from || to
        ? { date: { gte: from, lte: to } }
        : undefined,
    orderBy: [{ date: "desc" }, { session: "asc" }],
    take,
  })
}

/** The single record occupying one date/session slot, if it exists. */
export function getMilkRecord(date: Date, session: MilkSession) {
  return prisma.milkRecord.findUnique({
    where: { date_session: { date, session } },
  })
}

export function getMilkRecordByClientId(clientId: string) {
  return prisma.milkRecord.findUnique({ where: { clientId } })
}

/** Total liters across both sessions over a date range. */
export function sumMilkLiters(options: { from?: Date; to?: Date } = {}) {
  const { from, to } = options

  return prisma.milkRecord.aggregate({
    where: from || to ? { date: { gte: from, lte: to } } : undefined,
    _sum: { liters: true },
  })
}
