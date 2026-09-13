// Shared PIN constants. No `server-only` marker and no crypto: the lock screen
// is a client component and needs the same numbers the server enforces with.
// The hashing itself stays in `./pin`, which is server-only.

/** Digits a worker enters. Fixes the `input-otp` slot count on both screens. */
export const PIN_LENGTH = 4

/** Consecutive wrong entries before the lockout starts. */
export const MAX_PIN_ATTEMPTS = 5

/** How long entry stays locked once the attempt limit is hit. */
export const PIN_LOCKOUT_SECONDS = 60

export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)
}
