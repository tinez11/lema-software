// Bounds and vocabulary for a Land & Produce entry, shared by the controls the
// screen renders and the server action that validates them.
//
// Not `server-only`, for the same reason as `lib/milk-config.ts` and
// `lib/auth/pin-config.ts`: the quantity control is a client component, and a
// limit the UI offers but the action rejects is a bug that only shows up in
// the field.

/** A harvest that weighed less than this was not a harvest. */
export const MIN_HARVEST_QUANTITY = 0.5

/** A fat-finger guard, not a yield ceiling: no plot here fills 50,000 units. */
export const MAX_HARVEST_QUANTITY = 50_000

/** One tap of the stepper. Crates and bags are counted whole; kg is not. */
export const HARVEST_QUANTITY_STEP = 0.5

export const HARVEST_QUANTITY_DECIMALS = 1

/**
 * `HarvestRecord.unit` is a free `String` in the schema, so the fixed set lives
 * here instead.
 *
 * It has to be fixed somewhere: `sumHarvestQuantity()` groups by this column,
 * and free text turns one crop's yield into separate "kg", "Kg" and "kilos"
 * rows that never add up. These four are a starting set, not a researched one
 * — see open question 16.
 */
export const HARVEST_UNITS = ["kg", "bags", "crates", "bunches"] as const

export type HarvestUnit = (typeof HARVEST_UNITS)[number]

export const DEFAULT_HARVEST_UNIT: HarvestUnit = "kg"

/** A field bigger than this is a mistyped entry, not a smallholding. */
export const MAX_FIELD_ACRES = 10_000

/** Free text, so the cap is about storage sanity rather than meaning. */
export const MAX_NAME_LENGTH = 120
export const MAX_NOTE_LENGTH = 500

/** Matches `roundLiters`: snap to the precision the scale actually has. */
export function roundQuantity(quantity: number): number {
  const factor = 10 ** HARVEST_QUANTITY_DECIMALS

  return Math.round(quantity * factor) / factor
}

/**
 * Whether a quantity is one the server will accept: a real number, at least
 * the minimum, no more than the ceiling. The action re-checks this through
 * `zod` — this is the same rule in the form the client can call.
 */
export function isValidQuantity(quantity: number): boolean {
  return (
    Number.isFinite(quantity) &&
    quantity >= MIN_HARVEST_QUANTITY &&
    quantity <= MAX_HARVEST_QUANTITY
  )
}
