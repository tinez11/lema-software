"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LockIcon, WifiOffIcon } from "lucide-react"

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Button } from "@/components/ui/button"
import type { PinActionResult } from "@/lib/auth/actions"
import { MAX_PIN_ATTEMPTS, PIN_LENGTH } from "@/lib/auth/pin-config"
import { cn } from "@/lib/utils"

// Worker-facing, so it follows the worker treatment in ui-context.md: flat,
// high-contrast, one dominant h-14 action, no shadows. Every slot is h-14 too,
// so the whole screen is one touch size.

type PinPadProps = {
  title: string
  hint: string
  submitLabel: string
  /** Server action. Must resolve the caller from Clerk, never from a prop. */
  action: (pin: string) => Promise<PinActionResult>
  /** Shown on the lock screen only — there is nothing to forget while setting one. */
  forgotHint?: boolean
  redirectTo: string
}

type Feedback =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "offline" }
  | { kind: "locked"; until: number }

function secondsLeft(until: number): number {
  return Math.max(0, Math.ceil((until - Date.now()) / 1000))
}

export function PinPad({
  title,
  hint,
  submitLabel,
  action,
  forgotHint = false,
  redirectTo,
}: PinPadProps) {
  const router = useRouter()
  const [pin, setPin] = useState("")
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" })
  const [, setTick] = useState(0)

  // Derived, not stored: the countdown is a function of the lockout instant
  // and the current time, so a re-render each second is all it needs.
  const countdown = feedback.kind === "locked" ? secondsLeft(feedback.until) : 0
  const locked = countdown > 0

  useEffect(() => {
    if (feedback.kind !== "locked") return

    const timer = setInterval(() => setTick((tick) => tick + 1), 1000)

    return () => clearInterval(timer)
  }, [feedback])

  async function submit(value: string) {
    if (pending || locked) return

    setPending(true)

    try {
      const result = await action(value)

      switch (result.status) {
        case "ok":
          router.replace(redirectTo)
          router.refresh()
          return
        case "wrong":
          setPin("")
          setFeedback({
            kind: "error",
            message:
              result.attemptsRemaining === 1
                ? "Wrong PIN. 1 try left before a 60-second lockout."
                : `Wrong PIN. ${result.attemptsRemaining} of ${MAX_PIN_ATTEMPTS} tries left.`,
          })
          return
        case "locked":
          setPin("")
          setFeedback({
            kind: "locked",
            until: new Date(result.lockedUntilIso).getTime(),
          })
          return
        case "invalid-format":
          setPin("")
          setFeedback({
            kind: "error",
            message: `Enter all ${PIN_LENGTH} digits.`,
          })
          return
        default:
          setPin("")
          setFeedback({
            kind: "error",
            message: "That didn't work. Ask the owner to check your access.",
          })
      }
    } catch {
      // A server action that cannot reach the server throws. The PIN check is
      // deliberately central (the hash lives in Postgres), so there is nothing
      // to fall back to on-device — say so plainly instead of failing silently.
      setPin("")
      setFeedback({ kind: "offline" })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-5">
      <div className="flex w-full max-w-sm flex-col gap-8 rounded-2xl border-2 border-border bg-card p-5">
        <div className="flex flex-col gap-2">
          <LockIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="text-base text-muted-foreground">{hint}</p>
        </div>

        <InputOTP
          maxLength={PIN_LENGTH}
          value={pin}
          onChange={(value) => {
            setPin(value)
            if (feedback.kind === "error") setFeedback({ kind: "idle" })
          }}
          onComplete={submit}
          disabled={pending || locked}
          // A numeric keypad on phones, and the digits stay hidden over a shoulder.
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={`${PIN_LENGTH}-digit PIN`}
        >
          <InputOTPGroup className="w-full justify-between gap-3">
            {Array.from({ length: PIN_LENGTH }, (_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                aria-invalid={feedback.kind === "error" || locked}
                className="size-14 rounded-xl border-2 text-2xl font-semibold first:rounded-xl last:rounded-xl"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>

        <div
          role="status"
          aria-live="polite"
          className={cn(
            "min-h-12 text-base",
            feedback.kind === "idle" ? "text-muted-foreground" : "text-destructive"
          )}
        >
          {feedback.kind === "offline" && (
            <span className="flex items-start gap-2">
              <WifiOffIcon className="mt-1 h-4 w-4 shrink-0" aria-hidden />
              <span>
                No connection. Your PIN is checked on the server, so you&apos;ll
                need signal to unlock. Entries you already made are safe.
              </span>
            </span>
          )}
          {feedback.kind === "error" && feedback.message}
          {locked && `Too many wrong tries. Try again in ${countdown}s.`}
          {(feedback.kind === "idle" ||
            (feedback.kind === "locked" && !locked)) &&
            `${PIN_LENGTH} digits.`}
        </div>

        <Button
          type="button"
          onClick={() => submit(pin)}
          disabled={pending || locked || pin.length !== PIN_LENGTH}
          className="h-14 w-full rounded-xl text-lg font-semibold"
        >
          {pending ? "Checking…" : submitLabel}
        </Button>

        {forgotHint && (
          <p className="text-sm text-muted-foreground">
            Forgotten your PIN? Ask the owner to reset it — they can clear it
            from their dashboard, and you&apos;ll pick a new one next time you
            open the app.
          </p>
        )}
      </div>
    </div>
  )
}
