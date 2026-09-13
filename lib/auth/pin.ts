import "server-only"

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

export {
  MAX_PIN_ATTEMPTS,
  PIN_LENGTH,
  PIN_LOCKOUT_SECONDS,
  isValidPinFormat,
} from "./pin-config"

// PIN hashing primitives. Pure functions — no database, no Clerk — so
// `lib/db/users.ts` can depend on them without a cycle.
//
// A 4-digit PIN has only 10,000 combinations, so the hash alone is never the
// defence: scrypt makes each guess expensive, and the attempt lockout in
// `lib/db/users.ts` caps how many an attacker gets. The plaintext PIN exists
// only inside a server action's arguments — it is never logged, never stored,
// and never compared on the client.

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>

const SALT_BYTES = 16
const KEY_BYTES = 64

/** Returns `salt:derivedKey`, both hex. The format `User.pinHash` stores. */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const derivedKey = await scrypt(pin, salt, KEY_BYTES)

  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`
}

/** Constant-time comparison of a plaintext PIN against a stored hash. */
export async function verifyPinAgainstHash(
  pin: string,
  storedHash: string
): Promise<boolean> {
  const [saltHex, keyHex] = storedHash.split(":")

  if (!saltHex || !keyHex) return false

  const expected = Buffer.from(keyHex, "hex")

  // timingSafeEqual throws on a length mismatch, which would turn a corrupt
  // stored hash into a 500 instead of a failed unlock.
  if (expected.length !== KEY_BYTES) return false

  const candidate = await scrypt(pin, Buffer.from(saltHex, "hex"), KEY_BYTES)

  return timingSafeEqual(expected, candidate)
}
