"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { requireModule, requireOwner } from "@/lib/auth/roles"
import { resolveAuthGate } from "@/lib/auth/session"
import { createStockItem, recordSale } from "@/lib/db/shop"
import {
  MAX_SALE_LINES,
  MAX_SALE_QUANTITY,
  MAX_STOCK_NAME_LENGTH,
  MAX_STOCK_PRICE_CENTS,
  MIN_SALE_QUANTITY,
  roundSaleQuantity,
} from "@/lib/shop-config"

// The write path for the Shop, following `land/actions.ts` exactly: resolve
// the caller, validate with `zod`, call a query helper, `refresh()` on
// success. No action takes a user id.
//
// Money crosses this boundary as whole cents in both directions and never as a
// `Decimal` or a float — `lib/db/money.ts` does the conversion, once, below
// this layer. A sale never carries a client-supplied price at all: the till
// says *what* and *how many*, and `recordSale` prices it from the stock row.
//
// Nothing here takes a customer, an account or a balance. The shop is
// cash-only (`project-overview.md`), so there is no such field to accept.

const quantitySchema = z
  .number({ error: "Enter a quantity." })
  .min(MIN_SALE_QUANTITY, `Each line needs at least ${MIN_SALE_QUANTITY}.`)
  .max(MAX_SALE_QUANTITY, `That's over ${MAX_SALE_QUANTITY} on one line.`)

const createStockItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give it a name.")
    .max(MAX_STOCK_NAME_LENGTH, `Keep the name under ${MAX_STOCK_NAME_LENGTH} characters.`),
  category: z
    .string()
    .trim()
    .max(MAX_STOCK_NAME_LENGTH)
    .optional()
    .transform((value) => (value ? value : null)),
  unit: z.string().trim().min(1, "Say what it's sold by — each, kg, bag.").max(32),
  // Cents, not a decimal amount: the client converts at the input and the
  // column is written from this integer. An amount with a fraction of a cent
  // in it never reaches `fromCents`, which would throw.
  priceCents: z
    .number({ error: "Enter a price." })
    .int("A price is a whole number of cents.")
    .positive("A price has to be more than zero.")
    .max(MAX_STOCK_PRICE_CENTS, "That price looks like a misplaced decimal."),
})

const recordSaleSchema = z.object({
  lines: z
    .array(z.object({ stockItemId: z.string().min(1), quantity: quantitySchema }))
    .min(1, "Add something to the sale first.")
    .max(MAX_SALE_LINES, `A single sale can hold ${MAX_SALE_LINES} lines.`),
})

export type CreateStockItemInput = z.input<typeof createStockItemSchema>
export type RecordSaleInput = z.input<typeof recordSaleSchema>

export type CreateStockItemResult =
  | { status: "ok"; name: string }
  | { status: "not-owner" }
  | { status: "invalid"; message: string }
  | { status: "not-allowed" }

export type RecordSaleResult =
  | { status: "ok"; saleId: string; totalCents: number }
  | { status: "empty-sale" }
  | { status: "busy" }
  | { status: "unknown-item"; stockItemId: string }
  | {
      status: "insufficient-stock"
      stockItemId: string
      name: string
      available: number
      requested: number
    }
  | { status: "invalid"; message: string }
  | { status: "not-allowed" }
  | { status: "not-assigned" }

/** The first validation message, which is the one worth showing on a till. */
function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "That doesn't look right."
}

/**
 * Owner-only: adds something to the shop's catalogue.
 *
 * The owner check is the first statement, before the input is parsed — so a
 * worker's forged POST is refused without anything being read or written, and
 * `not-owner` comes back distinct from `invalid` so the message can state the
 * rule rather than complain about a correctly filled field.
 */
export async function createStockItemAction(
  input: CreateStockItemInput
): Promise<CreateStockItemResult> {
  const caller = requireOwner(await resolveAuthGate())

  if (!caller.ok) return { status: caller.status }

  const parsed = createStockItemSchema.safeParse(input)

  if (!parsed.success) {
    return { status: "invalid", message: firstIssue(parsed.error) }
  }

  const item = await createStockItem(
    parsed.data.name,
    parsed.data.category,
    parsed.data.unit,
    parsed.data.priceCents
  )

  refresh()

  return { status: "ok", name: item.name }
}

/**
 * Either role: rings up a cash sale.
 *
 * The client sends item ids and quantities and nothing else. Prices are read
 * from the stock rows inside `recordSale`'s transaction, and the stock check
 * that keeps `quantity` from going negative (invariant 4) is the conditional
 * update there — not anything this action could do on its own.
 */
export async function recordSaleAction(
  input: RecordSaleInput
): Promise<RecordSaleResult> {
  // `createStockItemAction` needs no module check: `requireOwner` already
  // guarantees an owner, and owners are never module-restricted.
  const caller = requireModule(await resolveAuthGate(), "SHOP")

  if (!caller.ok) return { status: caller.status }

  const parsed = recordSaleSchema.safeParse(input)

  if (!parsed.success) {
    return { status: "invalid", message: firstIssue(parsed.error) }
  }

  const result = await recordSale(
    parsed.data.lines.map((line) => ({
      stockItemId: line.stockItemId,
      quantity: roundSaleQuantity(line.quantity),
    })),
    caller.user.id
  )

  if (!result.ok) {
    return result.reason === "insufficient-stock"
      ? {
          status: "insufficient-stock",
          stockItemId: result.stockItemId,
          name: result.name,
          available: result.available,
          requested: result.requested,
        }
      : result.reason === "unknown-item"
        ? { status: "unknown-item", stockItemId: result.stockItemId }
        : result.reason === "busy"
          ? { status: "busy" }
          : { status: "empty-sale" }
  }

  refresh()

  return {
    status: "ok",
    saleId: result.sale.id,
    totalCents: result.sale.totalCents,
  }
}
