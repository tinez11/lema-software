import "server-only"

import { auth } from "@clerk/nextjs/server"

import { getUserById } from "@/lib/db/users"

import { isUnlocked } from "./unlock"

// Resolves a request to "who is this, and what screen are they allowed to see".
// Clerk answers the identity half; the Prisma row and the PIN cookie answer the
// rest. Owners never meet the PIN — their Clerk session is the whole story.

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getUserById>>>

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { userId } = await auth()

  if (!userId) return null

  return getUserById(userId)
}

export type AuthGate =
  | { state: "signed-out" }
  /** Signed into Clerk, but no Prisma row yet — the webhook has not landed. */
  | { state: "no-record"; clerkUserId: string }
  | { state: "revoked"; user: CurrentUser }
  | { state: "needs-pin-setup"; user: CurrentUser }
  | { state: "needs-unlock"; user: CurrentUser }
  | { state: "ready"; user: CurrentUser }

export async function resolveAuthGate(): Promise<AuthGate> {
  const { userId } = await auth()

  if (!userId) return { state: "signed-out" }

  const user = await getUserById(userId)

  if (!user) return { state: "no-record", clerkUserId: userId }
  if (!user.active) return { state: "revoked", user }
  if (user.role === "OWNER") return { state: "ready", user }

  if (!user.pinSetAt) return { state: "needs-pin-setup", user }
  if (!(await isUnlocked(user.id))) return { state: "needs-unlock", user }

  return { state: "ready", user }
}
