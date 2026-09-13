import { redirect } from "next/navigation"

import { AuthNotice } from "@/components/farm/auth-notice"
import { PinPad } from "@/components/farm/pin-pad"
import { setPinAction } from "@/lib/auth/actions"
import { resolveAuthGate } from "@/lib/auth/session"

// First sign-in for a worker: Clerk has authenticated them, and now they pick
// the PIN that will stand in for that on every later open. Reachable only
// while `pinSetAt` is null — changing an existing PIN is not part of this unit.
export default async function SetPinPage() {
  const gate = await resolveAuthGate()

  switch (gate.state) {
    case "signed-out":
      redirect("/sign-in")
    case "needs-unlock":
      redirect("/lock")
    case "ready":
      redirect("/")
    case "no-record":
      return (
        <AuthNotice title="Almost there">
          Your account exists, but it hasn&apos;t been linked to the farm yet.
          Ask the owner to check that your invite went through.
        </AuthNotice>
      )
    case "revoked":
      return (
        <AuthNotice title="Access revoked">
          This account no longer has access to the farm app.
        </AuthNotice>
      )
    case "needs-pin-setup":
      return (
        <PinPad
          title="Choose a PIN"
          hint="You'll use this to unlock the app on this device. Don't share it — every entry you make is recorded under your name."
          submitLabel="Set PIN"
          action={setPinAction}
          redirectTo="/"
        />
      )
  }
}
