import "server-only"

import { auth } from "@clerk/nextjs/server"

import { getUserById } from "@/lib/db/users"

import { isUnlocked } from "./unlock"

// Resolves a request to "who is this, and what screen are they allowed to see".
// Clerk answers the identity half; the Prisma row and the PIN cookie answer the
// rest. Owners never meet the PIN — their Clerk session is the whole story.

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getUserById>>>

/**
 * The signed-in user's Prisma row, or null if they are signed out or the
 * webhook has not created it yet.
 *
 * Says nothing about whether they may *use* the app — an inactive or locked
 * account comes back here like any other. `resolveAuthGate()` is what decides
 * that, and is what screens should ask.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { userId } = await auth()

  if (!userId) return null

  return getUserById(userId)
}

export type AuthGate =
  | { state: "signed-out" }
  /** Signed into Clerk, but no Prisma row yet — the webhook has not landed. */
  | { state: "no-record"; clerkUserId: string }
  /** Signed into Clerk with a row, but never approved by the owner. */
  | { state: "needs-approval"; user: CurrentUser }
  | { state: "revoked"; user: CurrentUser }
  | { state: "needs-pin-setup"; user: CurrentUser }
  | { state: "needs-unlock"; user: CurrentUser }
  | { state: "ready"; user: CurrentUser }

/**
 * Turns a request into the one thing the caller is allowed to see.
 *
 * The order is the security: signed out, then no row, then **inactive** — so
 * an unapproved or revoked account is refused before role, PIN or any data is
 * considered. Only `ready` means "use the app", and every server action in
 * the project checks for exactly that.
 */
export async function resolveAuthGate(): Promise<AuthGate> {
  const { userId } = await auth()

  if (!userId) return { state: "signed-out" }

  const user = await getUserById(userId)

  if (!user) return { state: "no-record", clerkUserId: userId }

  // Inactive splits two ways, because the two need opposite messages: "wait
  // for the owner" and "you no longer have access" are not the same news.
  //
  // `pinSetAt` tells them apart, because it is the record of having actually
  // been in: setting a PIN is the first thing an approved worker does, and
  // nothing but the owner's explicit PIN reset ever clears it —
  // `setWorkerActive` deliberately leaves it alone for this reason. So an
  // inactive row that never set a PIN has never had access, and is pending.
  //
  // The one case this reads generously is an owner who approves someone, that
  // person never opens the app, and the owner then revokes them: they are
  // shown "waiting for approval" rather than "revoked". Both are true enough
  // — they have no access and the owner decides — and an explicit
  // `approvedAt` column would make it exact. See open question 23.
  if (!user.active) {
    return user.pinSetAt
      ? { state: "revoked", user }
      : { state: "needs-approval", user }
  }
  if (user.role === "OWNER") return { state: "ready", user }

  if (!user.pinSetAt) return { state: "needs-pin-setup", user }
  if (!(await isUnlocked(user.id))) return { state: "needs-unlock", user }

  return { state: "ready", user }
}
