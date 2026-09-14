import "server-only"

import { Prisma } from "@prisma/client"

import { prisma } from "./client"
import { fromCents, toCents } from "./money"
import { INITIAL_STOCK_QUANTITY } from "../shop-config"

// Thin read helpers for the Shop. The shop is standalone retail: nothing here
// reads milk or harvest records, and nothing restocks from farm output.
//
// Price and revenue are owner-only (architecture.md, invariant 2). The plainly
// named helpers below select their columns explicitly and leave the financial
// ones out; the `...WithPricing()` / `...WithFinancials()` variants return
// them and may only be called once the caller has verified `role === OWNER`.
//
// Every privileged helper returns money as whole cents under a `...Cents` key,
// never as a `Decimal` — see `lib/db/money.ts`. The POS screen does live
// arithmetic on these numbers, so they have to be arithmetic-capable and exact,
// and the rename is what stops `unitPrice: 1250` being read as 1,250 whole units.

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

/**
 * What is on the shelf, alphabetically — quantities but no prices. The safe
 * path (invariant 2): a worker running the till sees units, never the price
 * list. `getStockItemsWithPricing()` is the owner's twin.
 */
export function getStockItems(options: { category?: string } = {}) {
  return prisma.stockItem.findMany({
    where: options.category ? { category: options.category } : undefined,
    select: stockItemSafeSelect,
    orderBy: { name: "asc" },
  })
}

/** Owner-only: adds `unitPriceCents`. Verify `role === OWNER` before calling. */
export async function getStockItemsWithPricing(
  options: { category?: string } = {}
) {
  const items = await prisma.stockItem.findMany({
    where: options.category ? { category: options.category } : undefined,
    orderBy: { name: "asc" },
  })

  return items.map(withUnitPriceCents)
}

/** One stock item without its price, or null. */
export function getStockItemById(id: string) {
  return prisma.stockItem.findUnique({
    where: { id },
    select: stockItemSafeSelect,
  })
}

/** Owner-only: adds `unitPriceCents`. Verify `role === OWNER` before calling. */
export async function getStockItemByIdWithPricing(id: string) {
  const item = await prisma.stockItem.findUnique({ where: { id } })

  return item ? withUnitPriceCents(item) : null
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

/**
 * Sales over a date range, newest first — who sold and when, but no amounts.
 * The safe path (invariant 2); `getSalesWithFinancials()` adds the total.
 */
export function getSales(options: { from?: Date; to?: Date; take?: number } = {}) {
  const { from, to, take } = options

  return prisma.sale.findMany({
    where: from || to ? { date: { gte: from, lte: to } } : undefined,
    select: saleSafeSelect,
    orderBy: { date: "desc" },
    take,
  })
}

/** Owner-only: adds `totalAmountCents`. Verify `role === OWNER` before calling. */
export async function getSalesWithFinancials(
  options: { from?: Date; to?: Date; take?: number } = {}
) {
  const { from, to, take } = options

  const sales = await prisma.sale.findMany({
    where: from || to ? { date: { gte: from, lte: to } } : undefined,
    orderBy: { date: "desc" },
    take,
  })

  return sales.map(withTotalAmountCents)
}

/**
 * One sale with its line items, or null — quantities only.
 *
 * The line items are selected, not included, so `unitPrice` and `subtotal`
 * stay out of the per-line shape too. A receipt that leaks the price on one
 * line leaks it just as surely as one that shows the total.
 */
export function getSaleById(id: string) {
  return prisma.sale.findUnique({
    where: { id },
    select: { ...saleSafeSelect, items: { select: saleItemSafeSelect } },
  })
}

/**
 * Owner-only: adds `totalAmountCents` and per-line `unitPriceCents` /
 * `subtotalCents`. Verify `role === OWNER` before calling.
 */
export async function getSaleByIdWithFinancials(id: string) {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { items: true },
  })

  if (!sale) return null

  const { items, ...rest } = sale

  return {
    ...withTotalAmountCents(rest),
    items: items.map(({ unitPrice, subtotal, ...item }) => ({
      ...item,
      unitPriceCents: toCents(unitPrice),
      subtotalCents: toCents(subtotal),
    })),
  }
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

/**
 * Owner-only: total sales revenue in cents. Verify `role === OWNER` first.
 *
 * A range with no sales sums to 0 rather than null — "sold nothing" is zero
 * revenue, and a nullable number invites a `?? 0` that one caller will forget.
 */
export async function sumSalesRevenueWithFinancials(
  options: { from?: Date; to?: Date } = {}
): Promise<{ totalCents: number }> {
  const { from, to } = options

  const { _sum } = await prisma.sale.aggregate({
    where: from || to ? { date: { gte: from, lte: to } } : undefined,
    _sum: { totalAmount: true },
  })

  return { totalCents: _sum.totalAmount ? toCents(_sum.totalAmount) : 0 }
}

// ───────────── Cents conversion ─────────────
//
// Written once each rather than inline at five call sites, so the `Decimal`
// never survives a copy-paste that forgets the conversion.

/**
 * Swaps a `unitPrice` `Decimal` for an integer `unitPriceCents`.
 *
 * Generic over the rest of the row so each caller keeps its own shape and
 * nothing has to restate the model's columns.
 */
function withUnitPriceCents<T extends { unitPrice: Prisma.Decimal }>(
  item: T
): Omit<T, "unitPrice"> & { unitPriceCents: number } {
  const { unitPrice, ...rest } = item

  return { ...rest, unitPriceCents: toCents(unitPrice) }
}

/** The same swap for a sale's `totalAmount`. */
function withTotalAmountCents<T extends { totalAmount: Prisma.Decimal }>(
  sale: T
): Omit<T, "totalAmount"> & { totalAmountCents: number } {
  const { totalAmount, ...rest } = sale

  return { ...rest, totalAmountCents: toCents(totalAmount) }
}

// ───────────── Sale-screen reads ─────────────

/**
 * What the till needs to sell an item: what it is, how much is left, and what
 * it costs — the price as an integer number of cents.
 *
 * **This is the one safe export that carries a financial figure**, and it is a
 * deliberate, narrow carve-out from invariant 2 rather than a crack in it. A
 * sale screen cannot function without a price to multiply against, and the
 * thing invariant 2 protects is the owner's commercial position: cost, margin,
 * revenue, profit. A worker standing at the till already knows the shelf price
 * — they are reading it to the customer. What they still never see is what the
 * stock cost to buy or what the shop has taken today.
 *
 * Keep it that way: this returns a *selling price per item* and nothing that
 * aggregates. `architecture.md` records the carve-out in invariant 2 itself.
 */
export async function getStockItemsForSale() {
  const items = await prisma.stockItem.findMany({
    select: { id: true, name: true, unit: true, quantity: true, unitPrice: true },
    orderBy: { name: "asc" },
  })

  return items.map(({ unitPrice, ...item }) => ({
    ...item,
    unitPriceCents: toCents(unitPrice),
  }))
}

/**
 * Recent sales as a worker may see them: when, who served, and what went out
 * the door, with **no** money at all — not the line prices, not the total.
 *
 * The till's own price list is `getStockItemsForSale()`; a history of takings
 * is the owner's business, and that is `getSalesHistoryWithFinancials()`.
 */
export async function getSalesHistory(options: { take?: number } = {}) {
  return prisma.sale.findMany({
    select: {
      id: true,
      date: true,
      recordedById: true,
      recordedBy: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          stockItem: { select: { id: true, name: true, unit: true } },
        },
      },
    },
    orderBy: { date: "desc" },
    take: options.take ?? 20,
  })
}

export type SaleHistoryEntry = Awaited<ReturnType<typeof getSalesHistory>>[number]

/**
 * Owner-only: the same history with the money on it, in cents. Verify
 * `role === OWNER` before calling.
 */
export async function getSalesHistoryWithFinancials(
  options: { take?: number } = {}
) {
  const sales = await prisma.sale.findMany({
    select: {
      id: true,
      date: true,
      totalAmount: true,
      recordedById: true,
      recordedBy: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          subtotal: true,
          stockItem: { select: { id: true, name: true, unit: true } },
        },
      },
    },
    orderBy: { date: "desc" },
    take: options.take ?? 20,
  })

  return sales.map(({ totalAmount, items, ...sale }) => ({
    ...sale,
    totalAmountCents: toCents(totalAmount),
    items: items.map(({ unitPrice, subtotal, ...item }) => ({
      ...item,
      unitPriceCents: toCents(unitPrice),
      subtotalCents: toCents(subtotal),
    })),
  }))
}

// ───────────── Writes ─────────────
//
// Creating a stock item is owner-only, and that check lives in
// `app/(app)/shop/actions.ts` where the caller's identity is resolved — never
// as a role parameter here (`code-standards.md`). Recording a sale is open to
// both roles: it is the shop's daily work.

/**
 * Registers something to sell, at a price given in whole cents.
 *
 * `StockItem` is reference data and carries no `enteredById`, the same as
 * `Field` — so there is no owner id to store and the parameter the spec named
 * is absent rather than accepted and dropped. Owner-only creation is enforced
 * in the action. See `architecture.md`, "Registry data carries no attribution".
 *
 * Quantity starts at zero on purpose: stocking the shelf is a separate,
 * explicit restock, which is invariant 3 — nothing about the shop's stock is
 * ever inferred from farm output or from anything else.
 */
export function createStockItem(
  name: string,
  category: string | null,
  unit: string,
  priceCents: number
): Promise<{ id: string; name: string }> {
  return prisma.stockItem.create({
    data: {
      name,
      category,
      unit,
      quantity: INITIAL_STOCK_QUANTITY,
      unitPrice: fromCents(priceCents),
    },
    select: { id: true, name: true },
  })
}

/** One line as the till hands it over: what, and how much of it. */
export type SaleLineInput = { stockItemId: string; quantity: number }

export type RecordSaleResult =
  | { ok: true; sale: { id: string; totalCents: number } }
  | { ok: false; reason: "empty-sale" }
  | { ok: false; reason: "unknown-item"; stockItemId: string }
  | {
      ok: false
      reason: "insufficient-stock"
      stockItemId: string
      name: string
      available: number
      requested: number
    }
  /** Too many tills contending for the same row to settle in time. */
  | { ok: false; reason: "busy" }

/**
 * Thrown inside the transaction to roll it back, carrying the typed result the
 * caller should see. Prisma only rolls back on a throw, so a refusal cannot
 * simply `return` — and the alternative, letting the failure escape as an
 * exception, is exactly what milk's duplicate slot and land's missing foreign
 * key both avoid.
 */
class SaleAborted extends Error {
  constructor(readonly result: Extract<RecordSaleResult, { ok: false }>) {
    super(`sale aborted: ${result.reason}`)
    this.name = "SaleAborted"
  }
}

/**
 * Records a cash sale and takes the stock off the shelf, atomically.
 *
 * **Invariant 4 — stock never goes negative — is enforced here, by the
 * database rather than by a check in this process.** Each line decrements with
 * a conditional `updateMany` whose `where` carries
 * `quantity: { gte: requested }`, so the read and the write are one statement
 * and one row lock. A read-then-write would let two tills both see six bags,
 * both decide four is fine, and both commit — leaving minus two. Here the
 * second one matches no rows, `count` comes back 0, and the whole sale rolls
 * back rather than half-applying.
 *
 * Prices come from the item's own row *inside* the transaction, never from the
 * client: a till that could name its own price is a till that can sell at zero.
 *
 * Duplicate lines for one item are merged before anything is written, so a
 * double-tap becomes one line of two rather than two decrements that each pass
 * the stock check on their own.
 */
export async function recordSale(
  items: readonly SaleLineInput[],
  recordedById: string
): Promise<RecordSaleResult> {
  const lines = mergeSaleLines(items)

  if (lines.length === 0) return { ok: false, reason: "empty-sale" }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const stockItems = await tx.stockItem.findMany({
        where: { id: { in: lines.map((line) => line.stockItemId) } },
        select: { id: true, name: true, quantity: true, unitPrice: true },
      })

      const byId = new Map(stockItems.map((item) => [item.id, item]))
      const priced: {
        stockItemId: string
        quantity: number
        unitPriceCents: number
        subtotalCents: number
      }[] = []

      for (const line of lines) {
        const item = byId.get(line.stockItemId)

        // Checked separately from the decrement below, because a conditional
        // update matches no rows for a missing item *and* for a short one —
        // and telling a worker "not enough stock" about something that does
        // not exist sends them to count a shelf that was never there.
        if (!item) {
          throw new SaleAborted({
            ok: false,
            reason: "unknown-item",
            stockItemId: line.stockItemId,
          })
        }

        const { count } = await tx.stockItem.updateMany({
          where: { id: item.id, quantity: { gte: line.quantity } },
          data: { quantity: { decrement: line.quantity } },
        })

        if (count === 0) {
          throw new SaleAborted({
            ok: false,
            reason: "insufficient-stock",
            stockItemId: item.id,
            name: item.name,
            // Read before the attempt, so it is what the worker saw. Another
            // till may have moved it since; the refusal is still correct.
            available: item.quantity,
            requested: line.quantity,
          })
        }

        const unitPriceCents = toCents(item.unitPrice)

        priced.push({
          stockItemId: item.id,
          quantity: line.quantity,
          unitPriceCents,
          // Rounded per line, the way a paper receipt adds up: the total is
          // the sum of what is printed, so it can never disagree with it.
          subtotalCents: Math.round(unitPriceCents * line.quantity),
        })
      }

      const totalCents = priced.reduce((sum, line) => sum + line.subtotalCents, 0)

      const created = await tx.sale.create({
        data: {
          recordedById,
          totalAmount: fromCents(totalCents),
          items: {
            create: priced.map((line) => ({
              stockItemId: line.stockItemId,
              quantity: line.quantity,
              unitPrice: fromCents(line.unitPriceCents),
              subtotal: fromCents(line.subtotalCents),
            })),
          },
        },
        select: { id: true },
      })

      return { id: created.id, totalCents }
    }, TRANSACTION_OPTIONS)

    return { ok: true, sale }
  } catch (error) {
    if (error instanceof SaleAborted) return error.result
    if (isTransactionTimeout(error)) return { ok: false, reason: "busy" }

    throw error
  }
}

/**
 * Prisma's defaults are 2s to get a transaction and 5s to finish one, and a
 * busy till breaks both.
 *
 * The stock row stays locked from its decrement until the commit, so
 * simultaneous sales of the same item queue up — and against a pooled, remote
 * Postgres each one costs a network round trip. Measured here: ten concurrent
 * sales of one item overran the 5s default and the tenth failed with a raw
 * `P2028` instead of selling. These numbers hold that queue rather than
 * shortening it; a sale that waits is right, a sale that explodes is not.
 */
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const

/**
 * A transaction that ran out of time rather than one that was refused.
 *
 * Reported as `busy` instead of thrown, for the same reason every other
 * failure in this file is typed: "try that again" is something a worker at a
 * till can act on, and a stack trace is not. Nothing was written — the
 * transaction rolled back — so a retry is safe.
 */
function isTransactionTimeout(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2028"
  )
}

/**
 * Collapses repeated lines for the same item into one.
 *
 * Two lines of three would otherwise be checked against stock separately, and
 * both could pass while the pair does not. Merging first means one decrement
 * per item, so the conditional update guards the whole quantity at once.
 */
function mergeSaleLines(
  items: readonly SaleLineInput[]
): { stockItemId: string; quantity: number }[] {
  const totals = new Map<string, number>()

  for (const item of items) {
    if (item.quantity <= 0) continue

    totals.set(item.stockItemId, (totals.get(item.stockItemId) ?? 0) + item.quantity)
  }

  return [...totals].map(([stockItemId, quantity]) => ({ stockItemId, quantity }))
}
