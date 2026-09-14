import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { AuthNotice } from "@/components/farm/auth-notice"
import { RelockOnForeground } from "@/components/farm/relock-on-foreground"
import { resolveAuthGate } from "@/lib/auth/session"

// Every real app screen lives under this group, so the gate is applied once
// here rather than remembered page by page. `proxy.ts` has already guaranteed
// a Clerk session; what this adds is the Prisma row and the PIN.
/**
 * Applies the auth gate once for every screen in the group.
 *
 * Each state resolves to exactly one outcome: a redirect for the two the user
 * can act on themselves, a notice for the three they cannot, and the children
 * only for `ready`. No page underneath re-decides any of it — they narrow the
 * type and trust this.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const gate = await resolveAuthGate()

  switch (gate.state) {
    case "signed-out":
      redirect("/sign-in")
    case "needs-pin-setup":
      redirect("/set-pin")
    case "needs-unlock":
      redirect("/lock")
    case "no-record":
      return (
        <AuthNotice title="Almost there">
          <p>
            Your account exists, but it hasn&apos;t been linked to the farm yet.
            Ask the owner to check that your invite went through, then sign in
            again.
          </p>
          {/* The owner's own row is seeded by hand, and this is the id that
              command needs — so it is shown rather than hidden in a log. */}
          <p className="mt-4 text-sm">
            Your account id:{" "}
            <code className="font-mono break-all">{gate.clerkUserId}</code>
          </p>
        </AuthNotice>
      )
    case "needs-approval":
      return (
        <AuthNotice title="Waiting for approval">
          <p>
            Your account exists, but the farm owner hasn&apos;t given it access
            yet. Nothing here is available until they do.
          </p>
          <p className="mt-4 text-sm">
            If you weren&apos;t expecting this, you don&apos;t have an account
            on this farm — signing up on your own doesn&apos;t grant access.
          </p>
        </AuthNotice>
      )
    case "revoked":
      return (
        <AuthNotice title="Access revoked">
          This account no longer has access to the farm app. Speak to the owner
          if that&apos;s unexpected.
        </AuthNotice>
      )
    case "ready":
      return (
        <>
          {children}
          {gate.user.role === "WORKER" && <RelockOnForeground />}
        </>
      )
  }
}
