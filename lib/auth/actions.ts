"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"

import {
  clearPinHash,
  getUserById,
  setPinHash,
  setWorkerActive,
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

/**
 * A worker choosing their PIN for the first time.
 *
 * Refuses anyone who is not an active worker without one — inactive included,
 * so a pending account cannot set a PIN by POSTing here and skip the owner's
 * approval. Setting a PIN also unlocks: they just proved they are at the
 * device.
 */
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

/**
 * Checks a PIN against the stored hash and unlocks the session on a match.
 *
 * The verdict — wrong, locked, or an inactive account — comes from
 * `verifyPinHash`, which owns the attempt count. Nothing here decides it.
 */
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

export type WorkerAccessResult =
  | { status: "ok"; active: boolean }
  | { status: "not-allowed" }

/**
 * Owner-only: grants or withdraws a worker's access to the farm's data.
 *
 * This is the approval half of default-deny. The Clerk webhook creates every
 * new account inactive, because a Clerk account existing is not authorisation
 * — Clerk's hosted sign-up page is reachable independently of this app, so
 * without this step anyone who found it could sign up, pick a PIN and reach
 * the till. Access now requires a deliberate act by someone who already has
 * it.
 *
 * The caller's identity is re-read from Clerk, never taken from a prop, so a
 * worker cannot approve themselves by POSTing to this action directly — which
 * would defeat the entire point of it.
 *
 * Only a `WORKER` is switchable. An owner cannot revoke another owner here,
 * and cannot revoke themselves into a farm with nobody who can let anyone
 * back in.
 */
export async function setWorkerAccessAction(
  workerId: string,
  active: boolean
): Promise<WorkerAccessResult> {
  const { userId } = await auth()

  if (!userId) return { status: "not-allowed" }

  const caller = await getUserById(userId)

  if (!caller || !caller.active || caller.role !== "OWNER") {
    return { status: "not-allowed" }
  }

  const target = await getUserById(workerId)

  if (!target || target.role !== "WORKER") return { status: "not-allowed" }

  const updated = await setWorkerActive(workerId, active)
  revalidatePath("/")

  return { status: "ok", active: updated.active }
}
