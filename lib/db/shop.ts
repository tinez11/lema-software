import "server-only"

import type { Prisma } from "@prisma/client"

import { prisma } from "./client"

// Thin read helpers for the Shop. The shop is standalone retail: nothing here
// reads milk or harvest records, and nothing restocks from farm output.
//
// Price and revenue are owner-only (architecture.md, invariant 2). The plainly
// named helpers below select their columns explicitly and leave the financial
// ones out; the `...WithPricing()` / `...WithFinancials()` variants return
// them and may only be called once the caller has verified `role === OWNER`.

/** Every StockItem column except `unitPrice`. */
const stockItemSafeSelect = {
  id: true,
  name: true,
  category: true,
  unit: true,
  quantity: true,
  lowStockThreshold: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StockItemSelect

/** Every Sale column except `totalAmount`. */
const saleSafeSelect = {
  id: true,
  clientId: true,
  date: true,
  deviceId: true,
  createdAt: true,
  recordedById: true,
} satisfies Prisma.SaleSelect

/** Every SaleItem column except `unitPrice` and `subtotal`. */
const saleItemSafeSelect = {
  id: true,
  saleId: true,
  stockItemId: true,
  quantity: true,
} satisfies Prisma.SaleItemSelect

// ───────────── Stock ─────────────

export function getStockItems(options: { category?: string } = {}) {
  return prisma.stockItem.findMany({
    where: options.category ? { category: options.category } : undefined,
    select: stockItemSafeSelect,
    orderBy: { name: "asc" },
  })
}

/** Owner-only: includes `unitPrice`. Verify `role === OWNER` before calling. */
export function getStockItemsWithPricing(options: { category?: string } = {}) {
  return prisma.stockItem.findMany({
    where: options.category ? { category: options.category } : undefined,
    orderBy: { name: "asc" },
  })
}

export function getStockItemById(id: string) {
  return prisma.stockItem.findUnique({
    where: { id },
    select: stockItemSafeSelect,
  })
}

/** Owner-only: includes `unitPrice`. Verify `role === OWNER` before calling. */
export function getStockItemByIdWithPricing(id: string) {
  return prisma.stockItem.findUnique({ where: { id } })
}

/** Items at or below their own low-stock threshold; items without one never alert. */
export function getLowStockItems() {
  return prisma.stockItem.findMany({
    where: {
      lowStockThreshold: { not: null },
      quantity: { lte: prisma.stockItem.fields.lowStockThreshold },
    },
    select: stockItemSafeSelect,
    orderBy: { quantity: "asc" },
  })
}

/** Stock movements carry no financial columns, so there is one path only. */
export function getStockAdjustments(
  options: { stockItemId?: string; take?: number } = {}
) {
  return prisma.stockAdjustment.findMany({
    where: options.stockItemId ? { stockItemId: options.stockItemId } : undefined,
    orderBy: { date: "desc" },
    take: options.take,
  })
}

// ───────────── Sales ─────────────

export function getSales(options: { from?: Date; to?: Date; take?: number } = {}) {
  const { from, to, take } = options

  return prisma.sale.findMany({
    where: from || to ? { date: { gte: from, lte: to } } : undefined,
    select: saleSafeSelect,
    orderBy: { date: "desc" },
    take,
  })
}

/** Owner-only: includes `totalAmount`. Verify `role === OWNER` before calling. */
export function getSalesWithFinancials(
  options: { from?: Date; to?: Date; take?: number } = {}
) {
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
    select: { ...saleSafeSelect, items: { select: saleItemSafeSelect } },
  })
}

/**
 * Owner-only: includes `totalAmount` and per-line `unitPrice` / `subtotal`.
 * Verify `role === OWNER` before calling.
 */
export function getSaleByIdWithFinancials(id: string) {
  return prisma.sale.findUnique({
    where: { id },
    include: { items: true },
  })
}

/** Units sold per stock item over a date range — quantities only. */
export function getUnitsSold(options: { from?: Date; to?: Date } = {}) {
  const { from, to } = options

  return prisma.saleItem.groupBy({
    by: ["stockItemId"],
    where: from || to ? { sale: { date: { gte: from, lte: to } } } : undefined,
    _sum: { quantity: true },
  })
}

/** Owner-only: total sales revenue. Verify `role === OWNER` before calling. */
export function sumSalesRevenueWithFinancials(
  options: { from?: Date; to?: Date } = {}
) {
  const { from, to } = options

  return prisma.sale.aggregate({
    where: from || to ? { date: { gte: from, lte: to } } : undefined,
    _sum: { totalAmount: true },
  })
}
