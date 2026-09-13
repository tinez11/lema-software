import { redirect } from "next/navigation"

import { AuthNotice } from "@/components/farm/auth-notice"
import { PinPad } from "@/components/farm/pin-pad"
import { unlockAction } from "@/lib/auth/actions"
import { resolveAuthGate } from "@/lib/auth/session"

// Sits outside the `(app)` group on purpose: a locked worker has to be able to
// reach this page, and the group's layout is what sent them here.
export default async function LockPage() {
  const gate = await resolveAuthGate()

  switch (gate.state) {
    case "signed-out":
      redirect("/sign-in")
    case "needs-pin-setup":
      redirect("/set-pin")
    case "ready":
      // Already unlocked, or the owner, who never sees this screen.
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
    case "needs-unlock":
      return (
        <PinPad
          title={`Welcome back, ${gate.user.name.split(" ")[0]}`}
          hint="Enter your PIN to unlock this device."
          submitLabel="Unlock"
          action={unlockAction}
          forgotHint
          redirectTo="/"
        />
      )
  }
}
