"use client"

import { useState, useTransition } from "react"
import { PencilIcon } from "lucide-react"
import type { MilkSession } from "@prisma/client"

import { QuantityStepper } from "@/components/farm/quantity-stepper"
import { sessionLabel } from "@/components/farm/session-toggle"
import { Button } from "@/components/ui/button"
import { editMilkAction } from "@/app/(app)/milk/actions"
import {
  MAX_MILK_LITERS,
  MILK_LITERS_DECIMALS,
  MILK_LITERS_STEP,
  MIN_MILK_LITERS,
} from "@/lib/milk-config"
import { cn } from "@/lib/utils"

// What has been logged, and the only way to correct it.
//
// `editable` is decided on the server — the viewer's own entry, logged today —
// so the list never offers a correction the action would refuse. The action
// and `updateMilkRecord` still re-check it; this flag is about not showing a
// dead button, not about permission.

export type MilkHistoryEntry = {
  id: string
  session: MilkSession
  liters: number
  /** Formatted server-side, in the same civil day the record was stored under. */
  dateLabel: string
  recordedByName: string
  editable: boolean
}

type MilkHistoryListProps = {
  entries: readonly MilkHistoryEntry[]
  emptyMessage: string
  /** Owner lists cut across workers, so they name who logged each entry. */
  showRecorder?: boolean
  /** Owner lists span days; the worker's "logged today" does not. */
  showDate?: boolean
  treatment: "owner" | "worker"
}

/**
 * Today's entries, or recent ones, already shaped and formatted by the page.
 *
 * Takes pre-formatted date strings rather than `Date`s because a `@db.Date`
 * has to be rendered in UTC to come back as the day it was logged, and that is
 * the server's job — see `lib/db/dates.ts`.
 */
export function MilkHistoryList({
  entries,
  emptyMessage,
  showRecorder = false,
  showDate = false,
  treatment,
}: MilkHistoryListProps) {
  const worker = treatment === "worker"

  if (entries.length === 0) {
    return (
      <p className={cn("text-muted-foreground", worker ? "text-base" : "text-sm")}>
        {emptyMessage}
      </p>
    )
  }

  return (
    <ul className={cn("flex flex-col", worker ? "gap-3" : "gap-2")}>
      {entries.map((entry) => (
        <MilkHistoryRow
          key={entry.id}
          entry={entry}
          showRecorder={showRecorder}
          showDate={showDate}
          worker={worker}
        />
      ))}
    </ul>
  )
}

/**
 * One entry, with the inline correction control when the viewer may use it.
 *
 * Keeps its own edit state so opening one row does not disturb another, and so
 * a failed save leaves that row's message beside that row.
 */
function MilkHistoryRow({
  entry,
  showRecorder,
  showDate,
  worker,
}: {
  entry: MilkHistoryEntry
  showRecorder: boolean
  showDate: boolean
  worker: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [liters, setLiters] = useState(entry.liters)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  /** Sends the correction and turns each typed result into something to read. */
  function save() {
    if (pending) return

    setError(null)

    startTransition(async () => {
      try {
        const result = await editMilkAction({ id: entry.id, liters })

        switch (result.status) {
          case "ok":
            setEditing(false)
            return
          case "not-yours":
            setError("That entry isn't yours to change. Ask the owner.")
            return
          case "too-old":
            setError("Entries can only be corrected on the day they're logged.")
            return
          case "invalid":
            setError(result.message)
            return
          case "not-assigned":
            setError("You're not assigned to Cows & Milk any more.")
            return
          case "not-allowed":
            setError("You're not signed in. Open the app again.")
            return
        }
      } catch {
        setError("No connection — the change wasn't saved.")
      }
    })
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-card",
        worker ? "border-2 border-border p-4" : "border border-border p-4 shadow-sm"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className={cn("font-semibold", worker ? "text-lg" : "text-base")}>
            {sessionLabel(entry.session)}
            {showDate && (
              <span className="font-normal text-muted-foreground">
                {" · "}
                {entry.dateLabel}
              </span>
            )}
          </span>
          {showRecorder && (
            <span className="text-sm text-muted-foreground">
              Logged by {entry.recordedByName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              "font-semibold tabular-nums text-moss",
              worker ? "text-2xl" : "text-xl"
            )}
          >
            {entry.liters} L
          </span>

          {entry.editable && !editing && (
            <Button
              variant="outline"
              onClick={() => {
                setLiters(entry.liters)
                setError(null)
                setEditing(true)
              }}
              className={cn(worker && "h-14 rounded-xl px-5 text-base")}
            >
              <PencilIcon className="h-4 w-4" aria-hidden />
              Edit
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <div className="flex flex-col gap-3">
          <QuantityStepper
            value={liters}
            onValueChange={(next) => {
              setLiters(next)
              setError(null)
            }}
            step={MILK_LITERS_STEP}
            min={0}
            max={MAX_MILK_LITERS}
            decimals={MILK_LITERS_DECIMALS}
            unit="L"
            label={`Liters for the ${sessionLabel(entry.session).toLowerCase()} entry`}
            disabled={pending}
          />

          {error && (
            <p role="status" aria-live="polite" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              onClick={save}
              disabled={pending || liters < MIN_MILK_LITERS}
              className={cn("flex-1 rounded-xl", worker && "h-14 text-lg font-semibold")}
            >
              {pending ? "Saving…" : "Save change"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(false)
                setError(null)
              }}
              disabled={pending}
              className={cn("rounded-xl", worker && "h-14 px-6 text-base")}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
