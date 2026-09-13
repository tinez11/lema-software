import "server-only"

import type { Prisma, Role } from "@prisma/client"

import {
  MAX_PIN_ATTEMPTS,
  PIN_LOCKOUT_SECONDS,
  hashPin,
  isValidPinFormat,
  verifyPinAgainstHash,
} from "../auth/pin"
import { prisma } from "./client"

// Read helpers for `User`. The model carries no financial columns, so the
// `...WithFinancials()` split from architecture.md invariant 2 does not apply
// here — but the same discipline does: `pinHash` is never selected by the
// default helper, and never leaves this module at all. Only
// `verifyPinHash()` reads it, and it returns a verdict, not the hash.

/** Every User column except `pinHash`. */
const userSafeSelect = {
  id: true,
  role: true,
  name: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  pinSetAt: true,
  pinFailedAttempts: true,
  pinLockedUntil: true,
} satisfies Prisma.UserSelect

export function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id }, select: userSafeSelect })
}

export function getUsers(options: { role?: Role; activeOnly?: boolean } = {}) {
  const { role, activeOnly } = options

  return prisma.user.findMany({
    where: {
      ...(role ? { role } : {}),
      ...(activeOnly ? { active: true } : {}),
    },
    select: userSafeSelect,
    orderBy: { name: "asc" },
  })
}

/**
 * Called by the Clerk webhook on `user.created`. Upserted rather than created
 * because Clerk retries a webhook it did not get a 2xx for, and a retry must
 * not fail or overwrite a role the owner has since changed.
 */
export function upsertUserFromClerk(input: { id: string; name: string }) {
  return prisma.user.upsert({
    where: { id: input.id },
    create: { id: input.id, name: input.name, role: "WORKER", active: true },
    update: {}, // an existing row wins: role and active are managed in-app
    select: userSafeSelect,
  })
}

// ───────────── PIN ─────────────

export type SetPinResult =
  | { status: "ok" }
  | { status: "invalid-format" }
  | { status: "unknown-user" }

/** Hashes and stores a new PIN, clearing any attempt count or lockout. */
export async function setPinHash(
  userId: string,
  pin: string
): Promise<SetPinResult> {
  if (!isValidPinFormat(pin)) return { status: "invalid-format" }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })

  if (!user) return { status: "unknown-user" }

  await prisma.user.update({
    where: { id: userId },
    data: {
      pinHash: await hashPin(pin),
      pinSetAt: new Date(),
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    },
  })

  return { status: "ok" }
}

/**
 * Clears a worker's PIN so their next open goes back through "Choose a PIN".
 * Also clears the attempt count and any lockout, so this doubles as the way
 * to let a locked-out worker straight back in.
 */
export async function clearPinHash(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      pinHash: null,
      pinSetAt: null,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    },
  })
}

export type VerifyPinResult =
  | { status: "ok" }
  | { status: "wrong"; attemptsRemaining: number }
  | { status: "locked"; lockedUntil: Date }
  | { status: "no-pin" }
  | { status: "inactive" }
  | { status: "unknown-user" }

/**
 * Compares a plaintext PIN against the stored hash, server-side, and keeps the
 * attempt count and lockout on the `User` row so a worker cannot reset them by
 * clearing client state or moving to another device.
 */
export async function verifyPinHash(
  userId: string,
  pin: string
): Promise<VerifyPinResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      active: true,
      pinHash: true,
      pinFailedAttempts: true,
      pinLockedUntil: true,
    },
  })

  if (!user) return { status: "unknown-user" }
  if (!user.active) return { status: "inactive" }

  const now = new Date()

  if (user.pinLockedUntil && user.pinLockedUntil > now) {
    return { status: "locked", lockedUntil: user.pinLockedUntil }
  }

  if (!user.pinHash) return { status: "no-pin" }

  // A lockout that has expired also clears the failures that caused it, so the
  // worker gets a full set of attempts back rather than one.
  const priorFailures = user.pinLockedUntil ? 0 : user.pinFailedAttempts

  // Checked after the lockout so a malformed entry cannot be used to probe
  // whether an account is locked.
  const matches = isValidPinFormat(pin)
    ? await verifyPinAgainstHash(pin, user.pinHash)
    : false

  if (matches) {
    await prisma.user.update({
      where: { id: userId },
      data: { pinFailedAttempts: 0, pinLockedUntil: null },
    })

    return { status: "ok" }
  }

  const failures = priorFailures + 1

  if (failures >= MAX_PIN_ATTEMPTS) {
    const lockedUntil = new Date(now.getTime() + PIN_LOCKOUT_SECONDS * 1000)

    await prisma.user.update({
      where: { id: userId },
      data: { pinFailedAttempts: failures, pinLockedUntil: lockedUntil },
    })

    return { status: "locked", lockedUntil }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { pinFailedAttempts: failures, pinLockedUntil: null },
  })

  return { status: "wrong", attemptsRemaining: MAX_PIN_ATTEMPTS - failures }
}
