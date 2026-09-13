"use client"

import { useState } from "react"
import { MinusIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// The first of the shared entry controls. Deliberately unaware of milk: a
// harvest weight and a stock count are the same shape, and this is the control
// they will reuse.
//
// Sized for the worker treatment in ui-context.md — `h-14`, `text-lg`, a 2px
// edge and no shadow — because the worker screen is the primary consumer, and
// ui-context says a stepper sitting beside the primary action must match its
// height so a row of targets is one size.

type QuantityStepperProps = {
  value: number
  onValueChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  /** Decimal places the value is rounded and displayed to. */
  decimals?: number
  /** Rendered inside the field, e.g. "L" or "kg". */
  unit?: string
  /** Used as the field's accessible name when no visible label points at `id`. */
  label?: string
  id?: string
  disabled?: boolean
  className?: string
}

export function QuantityStepper({
  value,
  onValueChange,
  step = 1,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  decimals = 0,
  unit,
  label,
  id,
  disabled = false,
  className,
}: QuantityStepperProps) {
  // Null means "show the committed value". While the worker is typing, the
  // raw string is kept instead, so a half-finished "1." or a cleared field
  // doesn't get snapped back to a number under their thumb.
  const [draft, setDraft] = useState<string | null>(null)

  function settle(next: number): number {
    const factor = 10 ** decimals

    return Math.min(max, Math.max(min, Math.round(next * factor) / factor))
  }

  function nudge(direction: 1 | -1) {
    setDraft(null)
    onValueChange(settle(value + direction * step))
  }

  function commit(raw: string) {
    setDraft(null)

    // Comma is what a numeric phone keypad offers in a lot of locales.
    const parsed = Number(raw.trim().replace(",", "."))

    // An unparseable entry keeps the last good value rather than zeroing the
    // field — re-reading the gauge is worse than re-typing one digit.
    if (raw.trim() === "" || !Number.isFinite(parsed)) return

    onValueChange(settle(parsed))
  }

  return (
    <div className={cn("flex items-stretch gap-3", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={() => nudge(-1)}
        disabled={disabled || value <= min}
        aria-label={`Decrease by ${step}`}
        className="h-14 w-14 shrink-0 rounded-xl border-2"
      >
        <MinusIcon className="h-5 w-5" aria-hidden />
      </Button>

      <div className="relative flex-1">
        <Input
          id={id}
          aria-label={label}
          inputMode="decimal"
          value={draft ?? value.toFixed(decimals)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onFocus={(event) => event.target.select()}
          disabled={disabled}
          className={cn(
            "h-14 rounded-xl border-2 text-center text-lg font-semibold tabular-nums md:text-lg",
            unit && "pr-10"
          )}
        />
        {unit && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-lg font-medium text-muted-foreground"
          >
            {unit}
          </span>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => nudge(1)}
        disabled={disabled || value >= max}
        aria-label={`Increase by ${step}`}
        className="h-14 w-14 shrink-0 rounded-xl border-2"
      >
        <PlusIcon className="h-5 w-5" aria-hidden />
      </Button>
    </div>
  )
}
