"use client"

import { useId } from "react"
import { CheckIcon, MoonIcon, SunriseIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { MilkSession } from "@prisma/client"

import { cn } from "@/lib/utils"

// Which milking a herd total belongs to. Two options and no third, ever —
// `MilkSession` is a closed enum and invariant 1 makes the pair (date, session)
// the identity of a record, so this is a choice, not a filter.
//
// Native radios under the surface rather than buttons with `role="radio"`:
// arrow-key movement, the checked state and the accessible group all come for
// free, and the label is what gets the worker-sized 56px target.
//
// `MilkSession` is imported as a *type* only. Pulling the runtime enum object
// out of `@prisma/client` here would drag the Prisma client into the browser
// bundle.

const SESSIONS: readonly {
  value: MilkSession
  label: string
  Icon: LucideIcon
}[] = [
  { value: "MORNING", label: "Morning", Icon: SunriseIcon },
  { value: "EVENING", label: "Evening", Icon: MoonIcon },
]

/** The one place a session is put into words, so no screen spells it twice. */
export function sessionLabel(session: MilkSession): string {
  return SESSIONS.find((option) => option.value === session)?.label ?? session
}

type SessionToggleProps = {
  value: MilkSession
  onValueChange: (value: MilkSession) => void
  /**
   * Sessions already logged for the day. Marked rather than disabled: the
   * clash is worth seeing before the tap, but the entry is still the way to
   * find out what was logged, and the server is what actually refuses it.
   */
  loggedSessions?: readonly MilkSession[]
  disabled?: boolean
  className?: string
}

export function SessionToggle({
  value,
  onValueChange,
  loggedSessions = [],
  disabled = false,
  className,
}: SessionToggleProps) {
  // One radio group per instance, so two forms on a page never share a name.
  const groupName = useId()

  return (
    <fieldset
      disabled={disabled}
      className={cn("grid grid-cols-2 gap-3", className)}
    >
      <legend className="sr-only">Milking session</legend>

      {SESSIONS.map(({ value: session, label, Icon }) => {
        const logged = loggedSessions.includes(session)

        return (
          <label key={session} className="cursor-pointer">
            <input
              type="radio"
              name={groupName}
              value={session}
              checked={value === session}
              onChange={() => onValueChange(session)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card text-lg font-semibold text-foreground transition-colors",
                "peer-checked:border-moss peer-checked:bg-moss peer-checked:text-moss-foreground",
                "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                "peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
              {logged && (
                <CheckIcon
                  className="h-4 w-4 opacity-70"
                  aria-label="Already logged"
                />
              )}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
