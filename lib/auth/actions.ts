"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"

import {
  clearPinHash,
  getUserById,
  setPinHash,
  verifyPinHash,
} from "@/lib/db/users"

import { isValidPinFormat } from "./pin-config"
import { clearUnlock, markUnlocked } from "./unlock"

// The writes in the PIN flow. Each one re-reads the caller's identity from
// Clerk rather than trusting an id from the client, so a worker can only ever
// set or check their own PIN, and only an owner can reset someone else's.

export type PinActionResult =
  | { status: "ok" }
  | { status: "invalid-format" }
  | { status: "wrong"; attemptsRemaining: number }
  | { status: "locked"; lockedUntilIso: string }
  | { status: "not-allowed" }

export async function setPinAction(pin: string): Promise<PinActionResult> {
  const { userId } = await auth()

  if (!userId) return { status: "not-allowed" }
  if (!isValidPinFormat(pin)) return { status: "invalid-format" }

  const user = await getUserById(userId)

  // Only a worker who has no PIN yet. Changing an existing PIN is a separate
  // flow that does not exist in this unit, and the owner never has one.
  if (!user || !user.active || user.role !== "WORKER" || user.pinSetAt) {
    return { status: "not-allowed" }
  }

  const result = await setPinHash(userId, pin)

  if (result.status !== "ok") {
    return result.status === "invalid-format"
      ? { status: "invalid-format" }
      : { status: "not-allowed" }
  }

  // Setting a PIN also unlocks: the worker just proved they are at the device.
  await markUnlocked(userId)

  return { status: "ok" }
}

export async function unlockAction(pin: string): Promise<PinActionResult> {
  const { userId } = await auth()

  if (!userId) return { status: "not-allowed" }

  // Format is checked inside verifyPinHash as well; doing it here too means a
  // malformed entry never costs the worker one of their attempts.
  if (!isValidPinFormat(pin)) return { status: "invalid-format" }

  const result = await verifyPinHash(userId, pin)

  switch (result.status) {
    case "ok":
      await markUnlocked(userId)
      return { status: "ok" }
    case "wrong":
      return { status: "wrong", attemptsRemaining: result.attemptsRemaining }
    case "locked":
      return { status: "locked", lockedUntilIso: result.lockedUntil.toISOString() }
    default:
      return { status: "not-allowed" }
  }
}

/** Drops the unlock so the next render shows the lock screen again. */
export async function lockAction(): Promise<void> {
  await clearUnlock()
}

export type ResetPinResult = { status: "ok" } | { status: "not-allowed" }

/**
 * Owner-only: wipes a worker's PIN so they can set a new one, and clears any
 * lockout with it.
 *
 * A worker cannot do this for themselves. Anyone sitting at a locked screen
 * already holds a cached Clerk session on that device — that is exactly the
 * case the PIN exists to stop — so a self-serve reset would hand the app to
 * whoever picked the phone up. Recovery goes through the owner instead, which
 * is also how invites and revocation already work.
 */
export async function resetWorkerPinAction(
  workerId: string
): Promise<ResetPinResult> {
  const { userId } = await auth()

  if (!userId) return { status: "not-allowed" }

  const caller = await getUserById(userId)

  if (!caller || !caller.active || caller.role !== "OWNER") {
    return { status: "not-allowed" }
  }

  const target = await getUserById(workerId)

  // Owners have no PIN, so there is nothing to reset and no reason to allow it.
  if (!target || target.role !== "WORKER") return { status: "not-allowed" }

  await clearPinHash(workerId)
  revalidatePath("/")

  return { status: "ok" }
}
