import "server-only"

import { Prisma } from "@prisma/client"

// Money crosses the server/client boundary as an **integer number of cents**,
// and this is the only place it changes form — the same discipline
// `lib/db/dates.ts` applies to civil days.
//
// Why not a string at the DTO boundary, which was the original guess: a string
// displays fine but cannot be arithmetic. The POS screen multiplies quantity
// by price on every stepper tap, so a string would have to be parsed back into
// a float right where precision matters most, which is the problem the
// `Decimal` column exists to avoid. Integer cents have no precision loss at
// any scale this farm will see — `Number.MAX_SAFE_INTEGER` is about 90 trillion
// dollars — and the client never holds a float that represents money.
//
// Reads convert on the way out, writes convert on the way back in, and
// formatting ("$12.50") happens only at final render, never here.

/** Postgres stores these as `Decimal(10, 2)`, so a cent is the smallest unit. */
const CENTS_PER_UNIT = 100

/**
 * A `Decimal` column as whole cents. 12.50 becomes 1250.
 *
 * `Decimal.times()` is exact, so the rounding below only ever fires on a value
 * that carried more than two decimal places — which `Decimal(10, 2)` cannot
 * store. It is here for values built in memory rather than read from Postgres.
 */
export function toCents(value: Prisma.Decimal): number {
  return value.times(CENTS_PER_UNIT).round().toNumber()
}

/** Same, for a nullable column. */
export function toCentsOrNull(value: Prisma.Decimal | null): number | null {
  return value === null ? null : toCents(value)
}

/**
 * Whole cents back to the `Decimal` a write needs. 1250 becomes 12.50.
 *
 * Throws rather than coercing: a non-integer here means cents were divided
 * somewhere upstream, and silently rounding money is how a till stops
 * balancing. The caller should not have produced a fraction of a cent.
 */
export function fromCents(cents: number): Prisma.Decimal {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(
      `Money must be a whole number of cents, got ${cents}. ` +
        `Divide only at the point of display, never before storage.`
    )
  }

  return new Prisma.Decimal(cents).dividedBy(CENTS_PER_UNIT)
}

/** Same, for a nullable column. */
export function fromCentsOrNull(cents: number | null): Prisma.Decimal | null {
  return cents === null ? null : fromCents(cents)
}
