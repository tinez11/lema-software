"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createCropCycleAction } from "@/app/(app)/land/actions"
import { MAX_NAME_LENGTH } from "@/lib/land-config"

// Owner-only, beside `field-form.tsx` and in the same treatment.
//
// A new cycle keeps the schema default, `PLANNED`. Nothing in this unit moves
// one to GROWING or HARVESTED — that transition is a deliberate follow-up, not
// something to infer from a harvest being logged.

export type FieldOption = { id: string; label: string }

type CropCycleFormProps = {
  fields: readonly FieldOption[]
  /** `YYYY-MM-DD` for today, computed server-side. */
  todayValue: string
}

/**
 * Owner-only form for opening a crop cycle on a field. Same arrangement as
 * `FieldForm`: hidden from workers, and refused by the action besides.
 */
export function CropCycleForm({ fields, todayValue }: CropCycleFormProps) {
  const [fieldId, setFieldId] = useState(fields[0]?.id ?? "")
  const [cropType, setCropType] = useState("")
  const [plantingDate, setPlantingDate] = useState(todayValue)
  const [expectedHarvestDate, setExpectedHarvestDate] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [pending, startTransition] = useTransition()

  const ready = fieldId !== "" && cropType.trim() !== "" && plantingDate !== ""

  /** Sends the form and turns each typed result into something to read. */
  function save() {
    if (!ready || pending) return

    setFeedback(null)

    startTransition(async () => {
      try {
        const result = await createCropCycleAction({
          fieldId,
          cropType,
          plantingDate,
          // An empty date box is "not planned yet", which the column holds as
          // null rather than as an empty string.
          expectedHarvestDate: expectedHarvestDate || null,
        })

        switch (result.status) {
          case "ok":
            setCropType("")
            setExpectedHarvestDate("")
            setFailed(false)
            setFeedback(`${result.cropType} cycle opened.`)
            return
          case "unknown-field":
            setFailed(true)
            setFeedback("That field no longer exists. Reload and pick again.")
            return
          case "not-owner":
            setFailed(true)
            setFeedback("Only the owner can open a crop cycle.")
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
        setFeedback("No connection — the crop cycle wasn't saved.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-base font-semibold">Open a crop cycle</h3>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a field first — a crop cycle is always planted in one.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cycle-field">Field</Label>
            <Select
              value={fieldId}
              onValueChange={setFieldId}
              disabled={pending}
            >
              <SelectTrigger id="cycle-field" className="h-11 w-full rounded-lg">
                <SelectValue placeholder="Pick a field" />
              </SelectTrigger>
              <SelectContent>
                {fields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cycle-crop">Crop</Label>
            <Input
              id="cycle-crop"
              value={cropType}
              maxLength={MAX_NAME_LENGTH}
              onChange={(event) => setCropType(event.target.value)}
              placeholder="Maize"
              disabled={pending}
              className="h-11 rounded-lg"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cycle-planting">Planting date</Label>
            <Input
              id="cycle-planting"
              type="date"
              value={plantingDate}
              onChange={(event) => setPlantingDate(event.target.value)}
              disabled={pending}
              className="h-11 rounded-lg"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cycle-harvest">Expected harvest (optional)</Label>
            <Input
              id="cycle-harvest"
              type="date"
              value={expectedHarvestDate}
              min={plantingDate || undefined}
              onChange={(event) => setExpectedHarvestDate(event.target.value)}
              disabled={pending}
              className="h-11 rounded-lg"
            />
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

          <Button
            onClick={save}
            disabled={!ready || pending}
            className="self-start rounded-lg"
          >
            {pending ? "Opening…" : "Open cycle"}
          </Button>
        </>
      )}
    </div>
  )
}
