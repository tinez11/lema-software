"use client"

import { useState } from "react"
import { AlertTriangleIcon, CheckCircle2Icon, WifiOffIcon } from "lucide-react"
import type { MilkSession } from "@prisma/client"

import { QuantityStepper } from "@/components/farm/quantity-stepper"
import { SessionToggle, sessionLabel } from "@/components/farm/session-toggle"
import { SubmitButton } from "@/components/farm/submit-button"
import { Label } from "@/components/ui/label"
import { logMilkAction } from "@/app/(app)/milk/actions"
import {
  MAX_MILK_LITERS,
  MILK_LITERS_DECIMALS,
  MILK_LITERS_STEP,
  MIN_MILK_LITERS,
} from "@/lib/milk-config"
import { useSingleFlight } from "@/lib/use-single-flight"
import { cn } from "@/lib/utils"

// The one write screen in Cows & Milk, shared by both roles: the worker meets
// it as their whole app, the owner as the top of the module home. The two
// differ in density only — ui-context.md's owner/worker table — never in what
// the form does or what the server will accept.

type Feedback =
  | { kind: "idle" }
  | { kind: "saved"; message: string }
  | { kind: "blocked"; message: string }
  | { kind: "offline" }

type MilkEntryFormProps = {
  treatment: "owner" | "worker"
  /** Formatted server-side: the browser's idea of "today" is not the farm's. */
  dateLabel: string
  /** Morning before the afternoon, evening after — the usual next entry. */
  defaultSession: MilkSession
  /** Sessions already filled for today, so the clash shows before the tap. */
  loggedSessions: readonly MilkSession[]
}

/**
 * The milk entry form, for both roles.
 *
 * `treatment` selects the density from `ui-context.md`'s owner/worker table —
 * panel edge, padding and button width — and nothing else. What the form does,
 * and what the server will accept, is identical for both.
 */
export function MilkEntryForm({
  treatment,
  dateLabel,
  defaultSession,
  loggedSessions,
}: MilkEntryFormProps) {
  const worker = treatment === "worker"

  const [session, setSession] = useState<MilkSession>(defaultSession)
  const [liters, setLiters] = useState(0)
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" })

  // 0 is a legal stepper position but not a legal entry: an empty churn is not
  // a milking. The server draws the same line, in `lib/milk-config.ts`.
  const ready = liters >= MIN_MILK_LITERS

  // Sends the entry and turns each typed result into something to read, and
  // reports whether one is in flight. The readiness check is repeated here
  // rather than left to the button: a disabled button does not stop the Enter
  // key submitting the form around it.
  const [submit, pending] = useSingleFlight(async () => {
    if (!ready) return

    setFeedback({ kind: "idle" })

    try {
      const result = await logMilkAction({ session, liters })

      switch (result.status) {
        case "ok":
          setLiters(0)
          setFeedback({
            kind: "saved",
            message: `${sessionLabel(session)} logged — ${result.liters} L.`,
          })
          return
        case "duplicate":
          setFeedback({
            kind: "blocked",
            message:
              `${sessionLabel(session)} is already logged today at ` +
              `${result.existing.liters} L by ${result.existing.recordedByName}. ` +
              `Correct that entry instead of adding a second one.`,
          })
          return
        case "invalid":
          setFeedback({ kind: "blocked", message: result.message })
          return
        case "not-assigned":
          setFeedback({
            kind: "blocked",
            message:
              "You're not assigned to Cows & Milk. Ask the owner if that's wrong.",
          })
          return
        case "not-allowed":
          setFeedback({
            kind: "blocked",
            message: "You're not signed in to log milk. Open the app again.",
          })
          return
      }
    } catch {
      // Same call as the PIN screens make: a thrown action is a lost
      // connection far more often than a broken server.
      setFeedback({ kind: "offline" })
    }
  })

  return (
    // A real `<form>`, though the values travel as React state rather than as
    // `FormData`: React's action mechanism is what `SubmitButton` reads its own
    // pending state from, and it is what lets the keyboard submit at all.
    <form
      action={submit}
      className={cn(
        "flex flex-col rounded-2xl bg-card",
        worker
          ? "gap-8 border-2 border-border p-5"
          : "gap-6 border border-border p-6 shadow-sm"
      )}
    >
      <div className="flex flex-col gap-1">
        <h2
          className={cn(
            "font-semibold text-foreground",
            worker ? "text-2xl" : "text-xl"
          )}
        >
          Log milk
        </h2>
        <p className={cn("text-muted-foreground", worker ? "text-base" : "text-sm")}>
          {dateLabel}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <span className={cn("font-medium", worker ? "text-lg" : "text-base")}>
          Session
        </span>
        <SessionToggle
          value={session}
          onValueChange={(next) => {
            setSession(next)
            setFeedback({ kind: "idle" })
          }}
          loggedSessions={loggedSessions}
          disabled={pending}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Label
          htmlFor="milk-liters"
          className={cn("font-medium", worker ? "text-lg" : "text-base")}
        >
          Liters collected
        </Label>
        <QuantityStepper
          id="milk-liters"
          value={liters}
          onValueChange={(next) => {
            setLiters(next)
            setFeedback({ kind: "idle" })
          }}
          step={MILK_LITERS_STEP}
          min={0}
          max={MAX_MILK_LITERS}
          decimals={MILK_LITERS_DECIMALS}
          unit="L"
          disabled={pending}
        />
      </div>

      {feedback.kind !== "idle" && (
        <FeedbackNote feedback={feedback} worker={worker} />
      )}

      <SubmitButton
        disabled={!ready}
        pendingLabel="Saving the entry…"
        className={cn(
          "h-14 rounded-xl text-lg font-semibold",
          worker ? "w-full" : "self-start px-8"
        )}
      >
        Save entry
      </SubmitButton>

      {!ready && (
        <p className="-mt-4 text-sm text-muted-foreground">
          Add the liters collected to save.
        </p>
      )}
    </form>
  )
}

/** The one-line result of a save: what happened, and whether it worked. */
function FeedbackNote({
  feedback,
  worker,
}: {
  feedback: Exclude<Feedback, { kind: "idle" }>
  worker: boolean
}) {
  const saved = feedback.kind === "saved"

  return (
    <p
      // Announced rather than only shown: on the worker screen the result of a
      // save is the only thing that changes, and a thumb may be covering it.
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 rounded-xl border-2 p-4",
        worker ? "text-base" : "text-sm",
        saved
          ? "border-moss/40 text-foreground"
          : "border-destructive/50 text-foreground"
      )}
    >
      {saved ? (
        <CheckCircle2Icon className="mt-0.5 h-5 w-5 shrink-0 text-moss" aria-hidden />
      ) : feedback.kind === "offline" ? (
        <WifiOffIcon className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
      ) : (
        <AlertTriangleIcon
          className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
          aria-hidden
        />
      )}
      {feedback.kind === "offline"
        ? "No connection — the entry wasn't saved. Try again once you're back online."
        : feedback.message}
    </p>
  )
}
