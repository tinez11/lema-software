"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { lockAction } from "@/lib/auth/actions"

// The spec locks the app "whenever it is opened or foregrounded". The session
// cookie covers opening — it dies with the browser session. This covers
// foregrounding: a shared device left on a bench and picked up by the next
// worker must not still be unlocked for the previous one.
//
// Mounted for workers only; the owner has no PIN to return to.
export function RelockOnForeground() {
  const router = useRouter()

  useEffect(() => {
    let hiddenAt: number | null = null
    // Set when a re-lock could not reach the server, so it can be retried the
    // moment the device is back online instead of being dropped.
    let lockPending = false

    function lock() {
      // If the device is offline this throws and the app stays unlocked until
      // the retry below lands. Locking the UI locally instead would strand a
      // worker in front of a screen they cannot unlock — the PIN is checked
      // server-side, so with no signal there is no way back in. See the
      // "PIN check is central" note in architecture.md.
      lockAction()
        .then(() => {
          lockPending = false
          router.refresh()
        })
        .catch(() => {
          lockPending = true
        })
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now()
        return
      }

      // Ignore the momentary blur of a notification shade or a permission
      // prompt; anything longer counts as the app having been put away.
      if (hiddenAt === null || Date.now() - hiddenAt < 2000) return

      hiddenAt = null
      lock()
    }

    function onOnline() {
      if (lockPending) lock()
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("online", onOnline)

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("online", onOnline)
    }
  }, [router])

  return null
}
