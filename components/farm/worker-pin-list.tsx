import { getUsers } from "@/lib/db/users"

import { ResetPinButton } from "./reset-pin-button"
import { WorkerAccessButton } from "./worker-access-button"

// Owner-only. Every worker the farm knows about, and the two things the owner
// can do about them: let them in (or out), and clear a forgotten PIN.
//
// Accounts are still created in Clerk, not here — but a Clerk account no
// longer grants access on its own. The webhook creates every new row
// **inactive**, because Clerk's hosted sign-up page is reachable independently
// of this app; without that, anyone who found it could sign up, choose a PIN
// and reach the till. This list is where that default-deny is undone,
// deliberately, by someone who already has access.
//
// Pending accounts sort first: they are the only rows that need an action, and
// a stranger appearing here is how the owner finds out someone tried.

/** Seconds of lockout left, read at request time rather than in the JSX. */
function lockoutSecondsLeft(lockedUntil: Date | null): number {
  if (!lockedUntil) return 0

  return Math.max(0, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000))
}

/**
 * What to say about a worker's current state, in the order that matters: not
 * approved, then cut off, then locked out, then whether they have a PIN.
 */
function statusOf(worker: {
  active: boolean
  pinSetAt: Date | null
  lockedFor: number
}): string {
  if (!worker.active) {
    return worker.pinSetAt
      ? "Access revoked"
      : "Waiting for approval — no access yet"
  }

  if (worker.lockedFor > 0) return `Locked out for ${worker.lockedFor}s`

  return worker.pinSetAt ? "PIN set" : "Will choose a PIN on next sign-in"
}

/**
 * Every worker the farm knows about, with the owner's two controls.
 *
 * Pending accounts sort to the top and carry a rust edge: they are the only
 * rows that need a decision, and an unexpected name appearing here is how the
 * owner learns someone tried to sign up.
 */
export async function WorkerPinList() {
  const workers = await getUsers({ role: "WORKER" })

  if (workers.length === 0) {
    return (
      <p className="text-base text-muted-foreground">
        No workers yet. Invite them from the Clerk dashboard and they&apos;ll
        appear here after their first sign-in, waiting for your approval.
      </p>
    )
  }

  // Anyone awaiting a decision first; the rest stay alphabetical as read.
  const ordered = [...workers].sort(
    (a, b) => Number(a.active) - Number(b.active)
  )

  return (
    <ul className="flex flex-col gap-3">
      {ordered.map((worker) => {
        const lockedFor = lockoutSecondsLeft(worker.pinLockedUntil)
        const pending = !worker.active && !worker.pinSetAt

        return (
          <li
            key={worker.id}
            className={
              pending
                ? "flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-rust/50 bg-card p-4"
                : "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
            }
          >
            <div className="flex flex-col">
              <span className="font-medium">{worker.name}</span>
              <span className="text-sm text-muted-foreground">
                {statusOf({
                  active: worker.active,
                  pinSetAt: worker.pinSetAt,
                  lockedFor,
                })}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Only worth offering once they actually have a PIN to clear. */}
              {worker.active && worker.pinSetAt && (
                <ResetPinButton workerId={worker.id} workerName={worker.name} />
              )}
              <WorkerAccessButton
                workerId={worker.id}
                workerName={worker.name}
                active={worker.active}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
