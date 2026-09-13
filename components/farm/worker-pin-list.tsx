import { getUsers } from "@/lib/db/users"

import { ResetPinButton } from "./reset-pin-button"

// Owner-only. The one thing the owner can do about PINs: clear one so the
// worker sets a new one on their next open. Workers themselves are created and
// revoked in the Clerk dashboard, so this list is not a management screen —
// it exists because a forgotten PIN otherwise has no way out.
/** Seconds of lockout left, read at request time rather than in the JSX. */
function lockoutSecondsLeft(lockedUntil: Date | null): number {
  if (!lockedUntil) return 0

  return Math.max(0, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000))
}

export async function WorkerPinList() {
  const workers = await getUsers({ role: "WORKER" })

  if (workers.length === 0) {
    return (
      <p className="text-base text-muted-foreground">
        No workers yet. Invite them from the Clerk dashboard and they&apos;ll
        appear here after their first sign-in.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {workers.map((worker) => {
        const lockedFor = lockoutSecondsLeft(worker.pinLockedUntil)

        return (
          <li
            key={worker.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex flex-col">
              <span className="font-medium">{worker.name}</span>
              <span className="text-sm text-muted-foreground">
                {!worker.active
                  ? "Access revoked"
                  : lockedFor > 0
                    ? `Locked out for ${lockedFor}s`
                    : worker.pinSetAt
                      ? "PIN set"
                      : "Will choose a PIN on next sign-in"}
              </span>
            </div>

            {worker.active && worker.pinSetAt && (
              <ResetPinButton workerId={worker.id} workerName={worker.name} />
            )}
          </li>
        )
      })}
    </ul>
  )
}
