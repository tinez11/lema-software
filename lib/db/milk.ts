import "server-only"

import type { MilkSession } from "@prisma/client"

import { prisma } from "./client"

// Thin read helpers for herd-total milk production. One record per date and
// session, guaranteed by the `@@unique([date, session])` constraint on
// `MilkRecord` — never per animal.
//
// `MilkRecord` carries no financial columns, so there is one path per query
// here: no `...WithFinancials()` variant exists or is needed.

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
    where: { date_session: { date, session } },
  })
}

export function getMilkRecordByClientId(clientId: string) {
  return prisma.milkRecord.findUnique({ where: { clientId } })
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
