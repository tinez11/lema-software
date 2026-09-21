import Link from "next/link"
import { MilkIcon, SproutIcon, StoreIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Module } from "@prisma/client"

import { moduleDefinition } from "@/lib/modules"
import { cn } from "@/lib/utils"

// One module's headline figure on the owner's dashboard.
//
// Presentational only: it takes an already-formatted `value` rather than a
// number and a unit, because the three modules count different things — liters,
// a unit-bearing harvest quantity, a money figure — and a card that formatted
// all three would end up knowing about all three.
//
// The whole card is the link. `ui-context.md` gives the grid equal weight per
// module, so no card is styled as the primary one.

const ICONS: Record<Module, LucideIcon> = {
  MILK: MilkIcon,
  LAND: SproutIcon,
  SHOP: StoreIcon,
}

const ACCENT_TEXT = {
  moss: "text-moss",
  gold: "text-gold",
  ochre: "text-ochre",
} as const

type MetricCardProps = {
  module: Module
  /** The figure itself, already formatted — "47.5 L", "120 kg", "18,400". */
  value: string
  /** What the figure counts, beneath it — "4 entries today". */
  detail: string
}

/**
 * A module's card: its name, one figure, and one line of context.
 *
 * The module's label and route come from the registry rather than from props,
 * so a card can never disagree with the nav about where a module lives.
 */
export function MetricCard({ module, value, detail }: MetricCardProps) {
  const definition = moduleDefinition(module)
  const Icon = ICONS[module]

  return (
    <Link
      href={definition.href ?? "#"}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-foreground/30"
    >
      <span className="flex items-center gap-2">
        <Icon
          className={cn("h-5 w-5", ACCENT_TEXT[definition.accent])}
          aria-hidden
        />
        <span className="text-sm font-medium text-muted-foreground">
          {definition.label}
        </span>
      </span>

      <span className="text-3xl font-semibold tabular-nums">{value}</span>
      <span className="text-sm text-muted-foreground">{detail}</span>
    </Link>
  )
}
