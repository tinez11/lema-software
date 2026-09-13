import "server-only"

import { prisma } from "./client"

// Thin read helpers for the Shop. The shop is standalone retail: nothing here
// reads milk or harvest records, and nothing restocks from farm output.
// Price and revenue are owner-only data — callers above this layer are
// responsible for that filtering.

export function listStockItems(options: { category?: string } = {}) {
  return prisma.stockItem.findMany({
    where: options.category ? { category: options.category } : undefined,
    orderBy: { name: "asc" },
  })
}

export function getStockItemById(id: string) {
  return prisma.stockItem.findUnique({ where: { id } })
}

/** Items at or below their own low-stock threshold; items without one never alert. */
export function listLowStockItems() {
  return prisma.stockItem.findMany({
    where: {
      lowStockThreshold: { not: null },
      quantity: { lte: prisma.stockItem.fields.lowStockThreshold },
    },
    orderBy: { quantity: "asc" },
  })
}

export function listStockAdjustments(
  options: { stockItemId?: string; take?: number } = {}
) {
  return prisma.stockAdjustment.findMany({
    where: options.stockItemId ? { stockItemId: options.stockItemId } : undefined,
    orderBy: { date: "desc" },
    take: options.take,
  })
}

export function listSales(options: { from?: Date; to?: Date; take?: number } = {}) {
  const { from, to, take } = options

  return prisma.sale.findMany({
    where: from || to ? { date: { gte: from, lte: to } } : undefined,
    orderBy: { date: "desc" },
    take,
  })
}

export function getSaleById(id: string) {
  return prisma.sale.findUnique({
    where: { id },
    include: { items: true },
  })
}

/** Units sold per stock item over a date range — quantities only, no revenue. */
export function sumUnitsSold(options: { from?: Date; to?: Date } = {}) {
  const { from, to } = options

  return prisma.saleItem.groupBy({
    by: ["stockItemId"],
    where: from || to ? { sale: { date: { gte: from, lte: to } } } : undefined,
    _sum: { quantity: true },
  })
}

/** Total sales revenue over a date range — owner-only data. */
export function sumSalesRevenue(options: { from?: Date; to?: Date } = {}) {
  const { from, to } = options

  return prisma.sale.aggregate({
    where: from || to ? { date: { gte: from, lte: to } } : undefined,
    _sum: { totalAmount: true },
  })
}
