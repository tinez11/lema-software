import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

// Tracks whether the PIN has been entered on this device *in this browser
// session*. Deliberately a session cookie with no `maxAge`: closing the app
// drops it, so reopening asks for the PIN again, which is what the spec means
// by "whenever the app is opened". Foregrounding is handled separately, by
// the client calling `lockNow()` when the document comes back into view.
//
// The cookie is signed so it cannot be hand-written to skip the PIN, and it
// names the user it was issued for, so a PIN unlock does not carry over to a
// different worker switching in on the same device.

const COOKIE_NAME = "farm_pin_unlock"

function unlockSecret(): string {
  const secret = process.env.PIN_UNLOCK_SECRET

  if (!secret) {
    throw new Error(
      "PIN_UNLOCK_SECRET is not set. Copy .env.example to .env and fill it in."
    )
  }

  return secret
}

function sign(userId: string): string {
  return createHmac("sha256", unlockSecret()).update(userId).digest("hex")
}

/** Marks this browser session unlocked for one user. Server actions only. */
export async function markUnlocked(userId: string): Promise<void> {
  const store = await cookies()

  store.set(COOKIE_NAME, `${userId}:${sign(userId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // No maxAge and no expires: a session cookie, gone when the app closes.
  })
}

/** Drops the unlock — on sign-out, on re-lock, and when the app is foregrounded. */
export async function clearUnlock(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

/** True only for a cookie this server signed, for this exact user. */
export async function isUnlocked(userId: string): Promise<boolean> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value

  if (!raw) return false

  const separator = raw.lastIndexOf(":")
  if (separator === -1) return false

  const cookieUserId = raw.slice(0, separator)
  const signature = raw.slice(separator + 1)

  if (cookieUserId !== userId) return false

  const expected = Buffer.from(sign(userId), "hex")
  const provided = Buffer.from(signature, "hex")

  if (expected.length !== provided.length) return false

  return timingSafeEqual(expected, provided)
}
