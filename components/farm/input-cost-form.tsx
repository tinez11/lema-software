"use client"

import { useState } from "react"
import type { InputType } from "@prisma/client"

import { ChoiceGrid } from "@/components/farm/choice-grid"
import type { ChoiceOption } from "@/components/farm/choice-grid"
import type { CropCycleOption } from "@/components/farm/harvest-entry-form"
import { SubmitButton } from "@/components/farm/submit-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createInputRecordAction } from "@/app/(app)/land/actions"
import { parseAmountToCents } from "@/lib/money"
import { useSingleFlight } from "@/lib/use-single-flight"

// Owner-only cost entry, in the owner treatment — the same arrangement as
// `field-form.tsx`, `crop-cycle-form.tsx` and `stock-item-form.tsx`: hidden
// from workers, and refused by the action besides.
//
// This is the only form in Land that carries money, so the amount is typed in
// whole currency and leaves as integer cents, exactly as the shop's stock-item
// form does it. Both call `parseAmountToCents` in `lib/money.ts` rather than
// each keeping a copy of the conversion.
//
// `InputType` is imported as a **type** only. Pulling the runtime enum object
// out of `@prisma/client` here would drag the Prisma client into the browser
// bundle — the same rule `session-toggle.tsx` follows for `MilkSession`. The
// action validates against the real enum, so the two cannot disagree about
// what is valid.

/**
 * What each `InputType` is called on screen.
 *
 * Typed as a complete `Record`, which is what makes it exhaustive: adding a
 * member to `InputType` in `schema.prisma` turns this into a compile error
 * rather than a silently missing cell. "Labour" rather than the enum's
 * American `LABOR`, matching the prose everywhere else in the project.
 */
const INPUT_TYPE_LABELS: Record<InputType, string> = {
  SEED: "Seed",
  FERTILIZER: "Fertilizer",
  PESTICIDE: "Pesticide",
  LABOR: "Labour",
}

// One cell per option at full width rather than a `Select`: `ui-context.md`'s
// line is whether the set is knowable in advance, and an enum in the schema is
// as knowable as it gets. The crop cycle above it grows with the farm, so that
// one is a `Select`.
//
// The cast is on `Object.keys`, which always types as `string[]`. The keys are
// the `Record`'s own, so the values are `InputType` by construction — and the
// `Record` is what guarantees the list is complete.
const INPUT_TYPE_OPTIONS: readonly ChoiceOption<InputType>[] = (
  Object.keys(INPUT_TYPE_LABELS) as InputType[]
).map((value) => ({ value, label: INPUT_TYPE_LABELS[value] }))

const DEFAULT_INPUT_TYPE: InputType = "SEED"

type InputCostFormProps = {
  /** Pre-composed server-side, the same shape the harvest form's picker takes. */
  cycles: readonly CropCycleOption[]
}

/**
 * Owner-only form for logging an input and its cost against a crop cycle.
 *
 * Rendered only inside the owner branch of `/land`, and
 * `createInputRecordAction` refuses a non-owner regardless — the hiding is
 * tidiness, the action is the boundary.
 */
export function InputCostForm({ cycles }: InputCostFormProps) {
  const [cropCycleId, setCropCycleId] = useState(cycles[0]?.id ?? "")
  const [type, setType] = useState<InputType>(DEFAULT_INPUT_TYPE)
  const [quantity, setQuantity] = useState("")
  const [cost, setCost] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  // The quantity is not part of this: the column is nullable, so an entry with
  // a cost and no count is complete.
  const ready = cropCycleId !== "" && cost.trim() !== ""

  // Sends the form and turns each typed result into something to read, and
  // reports whether one is in flight. The readiness check is repeated here
  // because a disabled button does not stop the Enter key submitting the form.
  const [submit, pending] = useSingleFlight(async () => {
    if (!ready) return

    setFeedback(null)

    const costCents = parseAmountToCents(cost)

    if (costCents === null) {
      setFailed(true)
      setFeedback("Enter the cost as an amount, like 12.50.")
      return
    }

    // An empty box means "not given", not zero — the column is nullable, and
    // an input nobody counted is not an input of nought.
    const parsedQuantity = quantity.trim() === "" ? null : Number(quantity)

    try {
      const result = await createInputRecordAction({
        cropCycleId,
        type,
        quantity: parsedQuantity,
        costCents,
      })

      switch (result.status) {
        case "ok":
          setQuantity("")
          setCost("")
          setFailed(false)
          setFeedback(`${INPUT_TYPE_LABELS[result.type]} cost logged.`)
          return
        case "unknown-cycle":
          setFailed(true)
          setFeedback("That crop cycle no longer exists. Reload and pick again.")
          return
        case "not-owner":
          setFailed(true)
          setFeedback("Only the owner can log an input cost.")
          return
        case "invalid":
          setFailed(true)
          setFeedback(result.message)
          return
        case "not-allowed":
          setFailed(true)
          setFeedback("You're not signed in. Open the app again.")
          return
      }
    } catch {
      setFailed(true)
      setFeedback("No connection — the input cost wasn't saved.")
    }
  })

  return (
    <form
      action={submit}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
    >
      <h3 className="text-base font-semibold">Log input cost</h3>

      {cycles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Open a crop cycle first — an input is always spent on one.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="input-cycle">Crop cycle</Label>
            <Select
              value={cropCycleId}
              onValueChange={setCropCycleId}
              disabled={pending}
            >
              <SelectTrigger id="input-cycle" className="h-11 w-full rounded-lg">
                <SelectValue placeholder="Pick a crop cycle" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((cycle) => (
                  <SelectItem key={cycle.id} value={cycle.id}>
                    {cycle.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">What was it</span>
            {/* `h-14` cells even on an owner screen: `ui-context.md` fixes the
                entry controls at one target size for both roles, because a
                control that changes size between roles is a second thing to
                get right for no gain. */}
            <ChoiceGrid
              value={type}
              onValueChange={setType}
              options={INPUT_TYPE_OPTIONS}
              legend="Input type"
              columns={4}
              accent="gold"
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="input-cost">Cost</Label>
            <Input
              id="input-cost"
              inputMode="decimal"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
              placeholder="12.50"
              disabled={pending}
              className="h-11 rounded-lg"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="input-quantity">Quantity (optional)</Label>
            <Input
              id="input-quantity"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="20"
              disabled={pending}
              className="h-11 rounded-lg"
            />
            {/* Said plainly rather than left to be guessed: the schema records
                no unit alongside an input quantity, so nothing downstream can
                interpret this number. See open question 25. */}
            <p className="text-sm text-muted-foreground">
              No unit is stored with this number — it is a count for your own
              reference. The cost is what the summary reports.
            </p>
          </div>

          {feedback && (
            <p
              role="status"
              aria-live="polite"
              className={failed ? "text-sm text-destructive" : "text-sm text-gold"}
            >
              {feedback}
            </p>
          )}

          <SubmitButton
            disabled={!ready}
            pendingLabel="Logging the cost…"
            className="self-start rounded-lg"
          >
            Log cost
          </SubmitButton>
        </>
      )}
    </form>
  )
}
