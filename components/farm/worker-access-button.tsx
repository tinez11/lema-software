"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { setWorkerAccessAction } from "@/lib/auth/actions"

// Approve or revoke, in one control. The two are one decision with two
// directions, and an owner who approves the wrong person needs the way back
// where they found the way in.
//
// Approving is one tap: the owner is granting access to someone they went
// looking for. Revoking is two, like the PIN reset beside it — it cuts off
// someone mid-shift, so it should take a moment's intent.

/**
 * The owner's approve/revoke control for one worker.
 *
 * Renders as "Approve" for a pending account and "Revoke" for a live one, so
 * the button always names what it will do rather than asking the owner to
 * read a state first.
 */
export function WorkerAccessButton({
  workerId,
  workerName,
  active,
}: {
  workerId: string
  workerName: string
  active: boolean
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  /** Sends the change and refreshes the list it was taken from. */
  function apply(next: boolean) {
    setError(null)

    startTransition(async () => {
      try {
        const result = await setWorkerAccessAction(workerId, next)

        if (result.status !== "ok") {
          setError("Couldn't change that.")
          return
        }

        setConfirming(false)
        router.refresh()
      } catch {
        setError("No connection — try again once you're back online.")
      }
    })
  }

  if (!active) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button onClick={() => apply(true)} disabled={pending}>
          {pending ? "Approving…" : "Approve"}
        </Button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    )
  }

  if (!confirming) {
    return (
      <Button variant="outline" onClick={() => setConfirming(true)}>
        Revoke
      </Button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Cut off {workerName}&apos;s access?
        </span>
        <Button
          variant="destructive"
          onClick={() => apply(false)}
          disabled={pending}
        >
          {pending ? "Revoking…" : "Yes, revoke"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setConfirming(false)
            setError(null)
          }}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  )
}
