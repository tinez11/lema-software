"use client"

import { useId } from "react"
import { CheckIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// One cell per option, at full width, for a choice with a small fixed set —
// the pattern `ui-context.md` prefers over a `Select` on a phone, where a
// dropdown costs two taps and hides the options until the first one.
//
// Native radios under the labels rather than buttons with `role="radio"`:
// arrow-key movement, the checked state and the accessible group all come for
// free, and the label is what gets the worker-sized 56px target.
//
// A `Select` is still right when the set is unbounded — a crop cycle picker
// grows with the farm, a unit picker does not.

export type ChoiceOption<T extends string> = {
  value: T
  label: string
  Icon?: LucideIcon
}

type ChoiceGridProps<T extends string> = {
  value: T
  onValueChange: (value: T) => void
  options: readonly ChoiceOption<T>[]
  /** The group's accessible name. Rendered as a screen-reader-only legend. */
  legend: string
  /** Options to flag with a check — already logged, already used. */
  markedValues?: readonly T[]
  markLabel?: string
  columns?: 2 | 3 | 4
  /** The module's accent, so a selected cell says which module it belongs to. */
  accent?: ModuleAccent
  disabled?: boolean
  className?: string
}

/** One per module, matching the accents `ui-context.md` assigns. */
export type ModuleAccent = "moss" | "gold" | "ochre"

const COLUMN_CLASS = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
} as const

// Written out rather than interpolated: Tailwind scans source text for class
// names, so a composed `peer-checked:bg-${accent}` is never generated.
const ACCENT_CLASS = {
  moss: "peer-checked:border-moss peer-checked:bg-moss peer-checked:text-moss-foreground",
  gold: "peer-checked:border-gold peer-checked:bg-gold peer-checked:text-gold-foreground",
  ochre:
    "peer-checked:border-ochre peer-checked:bg-ochre peer-checked:text-ochre-foreground",
} as const

export function ChoiceGrid<T extends string>({
  value,
  onValueChange,
  options,
  legend,
  markedValues = [],
  markLabel = "Already used",
  columns = 2,
  accent = "moss",
  disabled = false,
  className,
}: ChoiceGridProps<T>) {
  // One radio group per instance, so two grids on a page never share a name.
  const groupName = useId()

  return (
    <fieldset
      disabled={disabled}
      className={cn("grid gap-3", COLUMN_CLASS[columns], className)}
    >
      <legend className="sr-only">{legend}</legend>

      {options.map(({ value: option, label, Icon }) => (
        <label key={option} className="cursor-pointer">
          <input
            type="radio"
            name={groupName}
            value={option}
            checked={value === option}
            onChange={() => onValueChange(option)}
            className="peer sr-only"
          />
          <span
            className={cn(
              "flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card text-lg font-semibold text-foreground transition-colors",
              ACCENT_CLASS[accent],
              "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
              "peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
            )}
          >
            {Icon && <Icon className="h-5 w-5" aria-hidden />}
            {label}
            {markedValues.includes(option) && (
              <CheckIcon className="h-4 w-4 opacity-70" aria-label={markLabel} />
            )}
          </span>
        </label>
      ))}
    </fieldset>
  )
}
