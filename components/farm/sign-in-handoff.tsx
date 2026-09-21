"use client"

import { SignIn, useAuth } from "@clerk/nextjs"
import { Loader2Icon } from "lucide-react"

// The gap this covers is the one place in the app where nothing is on screen
// and nothing is the user's fault.
//
// Clerk finishing a sign-in is not the same moment as this app knowing what the
// person may see. `setActive()` invalidates the router cache, pushes `/`, and
// `resolveAuthGate()` then reads the Prisma row and the PIN cookie — and may
// send a worker on to `/set-pin` or `/lock`, which is another round trip. Every
// hop is a server render, and until the first one commits the browser is still
// on this page.
//
// Clerk's `<SignIn />` stays mounted underneath, because it is what performs
// that navigation — covering it is the point, unmounting it would strand the
// sign-in. `useAuth()` rather than `<Show when="signed-in">`: `Show` resolves
// server-side, so it cannot see a session that was created in this browser a
// moment ago.
//
// Deliberately not a route-level `loading.tsx`. This is one known handoff with
// a known cause, not a reason to put a skeleton in front of every route.

/** Clerk's sign-in card, plus the branded wait between it and the app. */
export function SignInHandoff() {
  const { isLoaded, isSignedIn } = useAuth()

  return (
    <>
      <SignIn />

      {isLoaded && isSignedIn && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background p-5 text-center"
        >
          <h1 className="text-2xl font-semibold text-foreground">
            Farm &amp; Shop Manager
          </h1>
          <Loader2Icon
            className="h-5 w-5 animate-spin text-muted-foreground"
            aria-hidden
          />
          <p className="text-base text-muted-foreground">
            Opening your screen…
          </p>
        </div>
      )}
    </>
  )
}
