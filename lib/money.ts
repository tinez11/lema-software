// Rendering money. The other half of `lib/db/money.ts`, and deliberately a
// separate file: that one is `server-only` because it touches `Prisma.Decimal`,
// while this one has to run in the browser, where the POS screen shows a
// running total that changes on every tap.
//
// The split is the rule in `code-standards.md` made structural — convert at the
// `lib/db/` boundary, format at final render, and nowhere in between.

/** Cents per whole unit, matching the `Decimal(10, 2)` columns. */
const CENTS_PER_UNIT = 100

/**
 * Whole cents as a human-readable amount: 1250 becomes "12.50".
 *
 * No currency symbol, because nothing in the context files names one — see
 * open question 20. `project-overview.md` rules multi-currency out of scope,
 * so there is exactly one currency; it simply has not been written down, and
 * guessing at a symbol would put an invented fact on every receipt.
 *
 * Grouped by locale (`1,234.56`) so a four-figure total is readable at a
 * glance on a till screen.
 */
export function formatCents(cents: number): string {
  return (cents / CENTS_PER_UNIT).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
