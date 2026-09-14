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
  assignedModules: true,
} satisfies Prisma.UserSelect

/**
 * One user by their Clerk id, or null if the webhook has not created the row
 * yet. Never selects `pinHash` — see the note above (invariant 6).
 */
export function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id }, select: userSafeSelect })
}

/**
 * Users by name. Narrow to one role, or to active accounts only.
 *
 * `activeOnly` is opt-in rather than the default because the owner's screens
 * need to see a revoked worker in order to say so; anything acting *on behalf
 * of* a user should pass it.
 */
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
 * Called by the Clerk webhook on `user.created`.
 *
 * **Creates the row inactive.** A Clerk account existing is not authorisation
 * to use the farm's data — Clerk's hosted sign-up page is reachable
 * independently of this app, so anyone who can reach it could otherwise sign
 * up, be handed a `WORKER` row, choose their own PIN and walk into the till.
 * Restricting sign-ups on the Clerk instance is still the right thing to do
 * (see `architecture.md`), but it is one external toggle that this codebase
 * cannot read back or assert, so the app refuses by default and the owner
 * approves. Access requires a deliberate act by someone who already has it.
 *
 * Upserted rather than created because Clerk retries a webhook it did not get
 * a 2xx for, and `update: {}` means an existing row always wins — so a
 * re-delivered `user.created` can never quietly deactivate a worker the owner
 * has already approved, nor overwrite a role.
 */
export function upsertUserFromClerk(input: { id: string; name: string }) {
  return prisma.user.upsert({
    where: { id: input.id },
    create: { id: input.id, name: input.name, role: "WORKER", active: false },
    update: {}, // an existing row wins: role and active are managed in-app
    select: userSafeSelect,
  })
}

/**
 * Grants or withdraws a worker's access.
 *
 * The same switch both ways on purpose: approving someone and revoking them
 * are one decision with two directions, and an owner who approves the wrong
 * person needs the way back in the same place they found the way in.
 *
 * This writes `active` and nothing else. Deliberately: the PIN is left alone
 * because `resolveAuthGate()` refuses an inactive user *before* a PIN is ever
 * checked, so a revoked worker's PIN is already inert — and `pinSetAt` is what
 * tells a never-approved account apart from a revoked one. Wiping it here
 * would make every revoked worker look like a pending one and get them the
 * wrong message. An owner who wants the PIN gone as well has
 * `resetWorkerPinAction` for exactly that, and re-approving then sends them
 * back through "choose a PIN".
 */
export function setWorkerActive(userId: string, active: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data: { active },
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
  // worker gets a full set of attempts back rather than one. Conditioned on the
  // expiry we just read, so a lockout set by a concurrent attempt is not wiped.
  if (user.pinLockedUntil) {
    await prisma.user.updateMany({
      where: { id: userId, pinLockedUntil: user.pinLockedUntil },
      data: { pinFailedAttempts: 0, pinLockedUntil: null },
    })
  }

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

  // Incremented by the database, not by re-writing a count read earlier: two
  // attempts racing would otherwise both read N and both write N+1, handing an
  // attacker a free guess per race. `increment` makes each attempt cost exactly
  // one, and the returned value is the committed count the lockout is based on.
  const { pinFailedAttempts: failures } = await prisma.user.update({
    where: { id: userId },
    data: { pinFailedAttempts: { increment: 1 } },
    select: { pinFailedAttempts: true },
  })

  if (failures >= MAX_PIN_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + PIN_LOCKOUT_SECONDS * 1000)

    await prisma.user.update({
      where: { id: userId },
      data: { pinLockedUntil: lockedUntil },
    })

    return { status: "locked", lockedUntil }
  }

  return { status: "wrong", attemptsRemaining: MAX_PIN_ATTEMPTS - failures }
}
