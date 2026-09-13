"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { resetWorkerPinAction } from "@/lib/auth/actions"

// Two taps, not one: clearing a worker's PIN mid-shift would lock them out of
// the screen they are standing at, so the owner has to mean it.
export function ResetPinButton({
  workerId,
  workerName,
}: {
  workerId: string
  workerName: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function reset() {
    setError(null)

    startTransition(async () => {
      try {
        const result = await resetWorkerPinAction(workerId)

        if (result.status !== "ok") {
          setError("Couldn't reset that PIN.")
          return
        }

        setConfirming(false)
        router.refresh()
      } catch {
        setError("No connection — try again once you're back online.")
      }
    })
  }

  if (!confirming) {
    return (
      <Button variant="outline" onClick={() => setConfirming(true)}>
        Reset PIN
      </Button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Clear {workerName}&apos;s PIN?
        </span>
        <Button variant="destructive" onClick={reset} disabled={pending}>
          {pending ? "Resetting…" : "Yes, reset"}
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
