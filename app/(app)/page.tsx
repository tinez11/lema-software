import { UserButton } from "@clerk/nextjs"

import { WorkerPinList } from "@/components/farm/worker-pin-list"
import { resolveAuthGate } from "@/lib/auth/session"

// Placeholder home. The owner dashboard and the worker entry screens are
// Phase 1 work; what this proves today is that the whole auth chain resolves —
// Clerk session, Prisma row, role, and PIN unlock.
export default async function Home() {
  const gate = await resolveAuthGate()
  const user = gate.state === "ready" ? gate.user : null

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <span className="text-lg font-semibold">Farm &amp; Shop Manager</span>
        {/* Sign-out lands on /signed-out (set on ClerkProvider), which clears
            the PIN unlock cookie before handing over to the sign-in page. */}
        <UserButton />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">
            {user ? `Signed in as ${user.name}` : "Signed in"}
          </h1>
          {user && (
            <p className="text-base text-muted-foreground">
              {user.role === "OWNER"
                ? "Owner — full access across all three modules."
                : "Worker — unlocked with your PIN on this device."}
            </p>
          )}
        </div>

        {user?.role === "OWNER" && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Worker PINs</h2>
            <p className="text-sm text-muted-foreground">
              Resetting clears a worker&apos;s PIN and any lockout. They choose
              a new one the next time they open the app.
            </p>
            <WorkerPinList />
          </section>
        )}
      </main>
    </div>
  )
}
