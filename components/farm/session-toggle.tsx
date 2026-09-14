"use client"

import { MoonIcon, SunriseIcon } from "lucide-react"
import type { MilkSession } from "@prisma/client"

import { ChoiceGrid } from "@/components/farm/choice-grid"
import type { ChoiceOption } from "@/components/farm/choice-grid"

// Which milking a herd total belongs to. Two options and no third, ever —
// `MilkSession` is a closed enum and invariant 1 makes the pair (date, session)
// the identity of a record, so this is a choice, not a filter.
//
// The cells themselves are `ChoiceGrid`; what lives here is the milk-specific
// half: the two sessions, their icons, and the words for them.
//
// `MilkSession` is imported as a *type* only. Pulling the runtime enum object
// out of `@prisma/client` here would drag the Prisma client into the browser
// bundle.

const SESSIONS: readonly ChoiceOption<MilkSession>[] = [
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

/**
 * Morning or evening, for a herd-total entry. A thin wrapper over
 * `ChoiceGrid` — the cells, radios and accent live there; what is here is the
 * milk-specific half.
 */
export function SessionToggle({
  value,
  onValueChange,
  loggedSessions = [],
  disabled = false,
  className,
}: SessionToggleProps) {
  return (
    <ChoiceGrid
      value={value}
      onValueChange={onValueChange}
      options={SESSIONS}
      legend="Milking session"
      markedValues={loggedSessions}
      markLabel="Already logged"
      accent="moss"
      disabled={disabled}
      className={className}
    />
  )
}
