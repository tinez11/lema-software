"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, LockIcon, WifiOffIcon } from "lucide-react"

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
    // The result of the last try is cleared as this one starts, so "checking"
    // is never shown beside "wrong PIN, 2 tries left" — and the slots drop
    // their invalid styling for the duration.
    setFeedback({ kind: "idle" })

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
          // Brings up a numeric keypad on phones.
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
                className={cn(
                  "size-14 rounded-xl border-2 text-2xl font-semibold first:rounded-xl last:rounded-xl",
                  // The generated slot prints the real digit, and it is not ours
                  // to edit. A filled slot hides its character and draws a dot
                  // over it instead, so a PIN entered in a barn doorway is not
                  // readable from a step away.
                  pin.length > index &&
                    "text-transparent after:absolute after:inset-0 after:m-auto after:size-3.5 after:rounded-full after:bg-foreground after:content-['']"
                )}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>

        {/* Three things can be true while a PIN sits on screen, and they are
            not the same news: the check is running, the check cannot be made,
            or the pad is shut. Conflating the first two would make a slow
            connection look like no connection, so "checking" is deliberately
            the only one of the three in muted type, with a turning loader
            rather than a static icon. */}
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "min-h-12 text-base",
            pending || feedback.kind === "idle"
              ? "text-muted-foreground"
              : "text-destructive"
          )}
        >
          {pending ? (
            <span className="flex items-start gap-2">
              <Loader2Icon
                className="mt-1 h-4 w-4 shrink-0 animate-spin"
                aria-hidden
              />
              <span>Checking your PIN…</span>
            </span>
          ) : (
            <>
              {feedback.kind === "offline" && (
                <span className="flex items-start gap-2">
                  <WifiOffIcon className="mt-1 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    No connection. Your PIN is checked on the server, so
                    you&apos;ll need signal to unlock. Entries you already made
                    are safe.
                  </span>
                </span>
              )}
              {feedback.kind === "error" && feedback.message}
              {locked && `Too many wrong tries. Try again in ${countdown}s.`}
              {(feedback.kind === "idle" ||
                (feedback.kind === "locked" && !locked)) &&
                `${PIN_LENGTH} digits.`}
            </>
          )}
        </div>

        {/* Not `SubmitButton`: this pad is not a `<form>` — `InputOTP`'s own
            Enter handling is what completes it — so there is no form status to
            read. The spinner treatment is the same one. */}
        <Button
          type="button"
          onClick={() => submit(pin)}
          disabled={pending || locked || pin.length !== PIN_LENGTH}
          aria-busy={pending || undefined}
          className="relative h-14 w-full rounded-xl text-lg font-semibold"
        >
          <span className={cn(pending && "invisible")}>{submitLabel}</span>
          {pending && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Loader2Icon className="size-5 animate-spin" aria-hidden />
              <span className="sr-only">Checking your PIN…</span>
            </span>
          )}
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
