"use client"

import { useState, useTransition } from "react"
import { AlertTriangleIcon, CheckCircle2Icon, WifiOffIcon } from "lucide-react"

import { ChoiceGrid } from "@/components/farm/choice-grid"
import { QuantityStepper } from "@/components/farm/quantity-stepper"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { logHarvestAction } from "@/app/(app)/land/actions"
import {
  DEFAULT_HARVEST_UNIT,
  HARVEST_QUANTITY_DECIMALS,
  HARVEST_QUANTITY_STEP,
  HARVEST_UNITS,
  MAX_HARVEST_QUANTITY,
  MIN_HARVEST_QUANTITY,
} from "@/lib/land-config"
import type { HarvestUnit } from "@/lib/land-config"
import { cn } from "@/lib/utils"

// The daily job in Land & Produce, and the one thing both roles do here.
// Setting up fields and crop cycles is the owner's registry work and lives in
// its own forms; this is the entry a worker opens the app to.
//
// Same shape as `milk-entry-form.tsx` — owner and worker differ in panel
// density and button width only, never in what the form does.

export type CropCycleOption = {
  id: string
  /** Pre-composed server-side: "Maize · North Field". */
  label: string
}

type Feedback =
  | { kind: "idle" }
  | { kind: "saved"; message: string }
  | { kind: "blocked"; message: string }
  | { kind: "offline" }

type HarvestEntryFormProps = {
  treatment: "owner" | "worker"
  /** Formatted server-side: the browser's idea of "today" is not the farm's. */
  dateLabel: string
  cycles: readonly CropCycleOption[]
}

const UNIT_OPTIONS = HARVEST_UNITS.map((unit) => ({ value: unit, label: unit }))

/**
 * The harvest entry form, for both roles.
 *
 * `treatment` selects the density from `ui-context.md`'s owner/worker table —
 * panel edge, padding and button width — and nothing else. What the form does,
 * and what the server will accept, is identical for both.
 */
export function HarvestEntryForm({
  treatment,
  dateLabel,
  cycles,
}: HarvestEntryFormProps) {
  const worker = treatment === "worker"

  const [cropCycleId, setCropCycleId] = useState(cycles[0]?.id ?? "")
  const [quantity, setQuantity] = useState(0)
  const [unit, setUnit] = useState<HarvestUnit>(DEFAULT_HARVEST_UNIT)
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" })
  const [pending, startTransition] = useTransition()

  const ready = cropCycleId !== "" && quantity >= MIN_HARVEST_QUANTITY

  /** Sends the entry and turns each typed result into something to read. */
  function save() {
    if (!ready || pending) return

    setFeedback({ kind: "idle" })

    startTransition(async () => {
      try {
        const result = await logHarvestAction({ cropCycleId, quantity, unit })

        switch (result.status) {
          case "ok":
            setQuantity(0)
            setFeedback({
              kind: "saved",
              message: `Harvest logged — ${result.quantity} ${result.unit}.`,
            })
            return
          case "unknown-cycle":
            setFeedback({
              kind: "blocked",
              message:
                "That crop cycle no longer exists. Reload and pick it again.",
            })
            return
          case "invalid":
            setFeedback({ kind: "blocked", message: result.message })
            return
          case "not-allowed":
            setFeedback({
              kind: "blocked",
              message: "You're not signed in to log a harvest. Open the app again.",
            })
            return
        }
      } catch {
        setFeedback({ kind: "offline" })
      }
    })
  }

  return (
    <section
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
          Log a harvest
        </h2>
        <p className={cn("text-muted-foreground", worker ? "text-base" : "text-sm")}>
          {dateLabel}
        </p>
      </div>

      {cycles.length === 0 ? (
        // Not an error state: a farm with no crop cycles yet is the normal
        // starting point, and only the owner can do anything about it.
        <p
          className={cn(
            "rounded-xl border-2 border-border p-4 text-muted-foreground",
            worker ? "text-base" : "text-sm"
          )}
        >
          There are no crop cycles to harvest against yet. The owner sets those
          up before anything can be logged here.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <Label
              htmlFor="harvest-cycle"
              className={cn("font-medium", worker ? "text-lg" : "text-base")}
            >
              Crop cycle
            </Label>
            {/* A Select rather than one cell per option: the cycle list grows
                with the farm, so it is not the small fixed set ui-context.md
                reserves the full-width grid for. */}
            <Select
              value={cropCycleId}
              onValueChange={(next) => {
                setCropCycleId(next)
                setFeedback({ kind: "idle" })
              }}
              disabled={pending}
            >
              <SelectTrigger
                id="harvest-cycle"
                className="h-14 w-full rounded-xl border-2 text-lg md:text-lg"
              >
                <SelectValue placeholder="Pick a crop cycle" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((cycle) => (
                  <SelectItem key={cycle.id} value={cycle.id} className="text-base">
                    {cycle.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3">
            <Label
              htmlFor="harvest-quantity"
              className={cn("font-medium", worker ? "text-lg" : "text-base")}
            >
              Quantity harvested
            </Label>
            <QuantityStepper
              id="harvest-quantity"
              value={quantity}
              onValueChange={(next) => {
                setQuantity(next)
                setFeedback({ kind: "idle" })
              }}
              step={HARVEST_QUANTITY_STEP}
              min={0}
              max={MAX_HARVEST_QUANTITY}
              decimals={HARVEST_QUANTITY_DECIMALS}
              unit={unit}
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-3">
            <span className={cn("font-medium", worker ? "text-lg" : "text-base")}>
              Unit
            </span>
            <ChoiceGrid
              value={unit}
              onValueChange={(next) => {
                setUnit(next)
                setFeedback({ kind: "idle" })
              }}
              options={UNIT_OPTIONS}
              legend="Harvest unit"
              columns={4}
              accent="gold"
              disabled={pending}
            />
          </div>

          {feedback.kind !== "idle" && (
            <FeedbackNote feedback={feedback} worker={worker} />
          )}

          <Button
            onClick={save}
            disabled={!ready || pending}
            className={cn(
              "h-14 rounded-xl text-lg font-semibold",
              worker ? "w-full" : "self-start px-8"
            )}
          >
            {pending ? "Saving…" : "Save harvest"}
          </Button>

          {!ready && (
            <p className="-mt-4 text-sm text-muted-foreground">
              Pick a crop cycle and add the quantity to save.
            </p>
          )}
        </>
      )}
    </section>
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
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 rounded-xl border-2 p-4",
        worker ? "text-base" : "text-sm",
        saved ? "border-gold/40 text-foreground" : "border-destructive/50 text-foreground"
      )}
    >
      {saved ? (
        <CheckCircle2Icon className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
      ) : feedback.kind === "offline" ? (
        <WifiOffIcon className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
      ) : (
        <AlertTriangleIcon
          className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
          aria-hidden
        />
      )}
      {feedback.kind === "offline"
        ? "No connection — the harvest wasn't saved. Try again once you're back online."
        : feedback.message}
    </p>
  )
}
