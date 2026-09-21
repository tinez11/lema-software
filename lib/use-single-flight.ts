"use client"

import { useRef, useState } from "react"

// One tap, one submission.
//
// Disabling the button while a write is in flight is what the worker sees, but
// it is not what makes the write happen once. `pending` is state: two taps
// landing before React has re-rendered both read the value from before the
// first one, so both get through. Next then dispatches them one after the
// other rather than dropping the second —
// `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, "Sequential
// dispatch on the client" — which on the till is a second sale, not a no-op.
//
// So the guard has to be synchronous, which means a ref and not state. The
// state beside it is only for what the screen shows.

/**
 * Wraps a form's submit handler so a second call while the first is still in
 * flight is dropped, and reports whether one is in flight.
 *
 * The boolean is for the form's own controls — its fields and steppers, which
 * the component rendering the `<form>` owns. The button inside reads the same
 * flight for itself through `useFormStatus()`, which only a descendant of the
 * `<form>` can call; see `components/farm/submit-button.tsx`.
 */
export function useSingleFlight(
  run: () => Promise<void>
): readonly [submit: () => Promise<void>, pending: boolean] {
  const inFlight = useRef(false)
  const [pending, setPending] = useState(false)

  async function submit() {
    if (inFlight.current) return

    inFlight.current = true
    setPending(true)

    try {
      await run()
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return [submit, pending]
}
