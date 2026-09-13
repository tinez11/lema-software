// Bounds for a herd-total milk entry, shared by the stepper and the server
// action that validates it.
//
// Deliberately *not* `server-only`, for the same reason as
// `lib/auth/pin-config.ts`: the control the worker touches is a client
// component, and a limit the UI offers but the server rejects — or the other
// way round — is a bug waiting to happen. One file, both sides.

/** A milking that produced less than this was not a milking. */
export const MIN_MILK_LITERS = 0.5

/** A fat-finger guard, not a herd ceiling: no yard here fills 2000 L a session. */
export const MAX_MILK_LITERS = 2000

/** One tap of the stepper. Churn gauges are read to the half-liter. */
export const MILK_LITERS_STEP = 0.5

/** Liters are read off a gauge, not a lab scale — one decimal place is the truth. */
export const MILK_LITERS_DECIMALS = 1

/**
 * Snaps a reading to the precision the gauge actually has, which also clears
 * the float dust a run of `+ 0.5` taps leaves behind (0.1 + 0.2 = 0.30000000000000004).
 */
export function roundLiters(liters: number): number {
  const factor = 10 ** MILK_LITERS_DECIMALS

  return Math.round(liters * factor) / factor
}

export function isValidLiters(liters: number): boolean {
  return (
    Number.isFinite(liters) &&
    liters >= MIN_MILK_LITERS &&
    liters <= MAX_MILK_LITERS
  )
}
