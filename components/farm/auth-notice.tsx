import type { ReactNode } from "react"
import { SignOutButton } from "@clerk/nextjs"

import { Button } from "@/components/ui/button"

// Shown when someone is signed into Clerk but the app cannot let them in:
// no Prisma row yet, or access revoked. Both are resolved by the owner rather
// than by retrying, so there is no retry button — but there is a way out, so a
// shared device is not stranded on this screen with someone else's session.
export function AuthNotice({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border-2 border-border bg-card p-5">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <div className="text-base text-muted-foreground">{children}</div>
        {/* Routed through /signed-out so the PIN unlock cookie goes too. */}
        <SignOutButton redirectUrl="/signed-out">
          <Button
            variant="outline"
            className="h-14 w-full rounded-xl text-lg font-semibold"
          >
            Sign out
          </Button>
        </SignOutButton>
      </div>
    </div>
  )
}
