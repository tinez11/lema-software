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

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now()
        return
      }

      // Ignore the momentary blur of a notification shade or a permission
      // prompt; anything longer counts as the app having been put away.
      if (hiddenAt === null || Date.now() - hiddenAt < 2000) return

      hiddenAt = null

      // If the device is offline this throws, and the app simply stays
      // unlocked — the alternative is locking a worker out of a screen they
      // are standing in front of with no way back in.
      lockAction()
        .then(() => router.refresh())
        .catch(() => undefined)
    }

    document.addEventListener("visibilitychange", onVisibilityChange)

    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [router])

  return null
}
