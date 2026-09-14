// Bounds for a shop sale, shared by the till screen and the action that
// validates it — the same arrangement as `milk-config.ts` and
// `land-config.ts`, and not `server-only` for the same reason: the quantity
// control is a client component and must offer exactly the range the server
// accepts.

/** A sale line of nothing is not a line. */
export const MIN_SALE_QUANTITY = 0.5

/** A fat-finger guard on one line, not a warehouse limit. */
export const MAX_SALE_QUANTITY = 10_000

/** One tap. Half units, so loose goods sold by weight still work. */
export const SALE_QUANTITY_STEP = 0.5

export const SALE_QUANTITY_DECIMALS = 1

/** More lines than this on one cash sale is a mis-tap, not a shop run. */
export const MAX_SALE_LINES = 50

/** Free text, so the cap is about storage sanity rather than meaning. */
export const MAX_STOCK_NAME_LENGTH = 120

/**
 * A price ceiling in cents, to catch a misplaced decimal. The column is
 * `Decimal(10, 2)`, so the hard limit is far higher; this is the sane limit.
 */
export const MAX_STOCK_PRICE_CENTS = 100_000_00

/** Stock quantity a new item starts at, until a restock says otherwise. */
export const INITIAL_STOCK_QUANTITY = 0

/** Matches `roundLiters` / `roundQuantity`: snap to the precision on offer. */
export function roundSaleQuantity(quantity: number): number {
  const factor = 10 ** SALE_QUANTITY_DECIMALS

  return Math.round(quantity * factor) / factor
}
