import Link from "next/link"
import { ChevronRightIcon, MilkIcon, SproutIcon, StoreIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Module } from "@prisma/client"

import { modulesFor } from "@/lib/modules"
import { cn } from "@/lib/utils"

// The way between modules, for both roles.
//
// This replaces the single hardcoded `/land` link the Land & Produce unit left
// behind. What a user is offered now comes from `User.assignedModules`, where
// an empty list means all three — so nothing was taken from anyone when the
// column arrived, and narrowing a worker to one module is a data change rather
// than a code change.
//
// Still deliberately a list of links and not a dashboard. The cross-module
// metric grid `ui-context.md` describes is a different thing, and it waits for
// all three modules to have a write path.
//
// It is a *labelled, ruled-off* group rather than more cards in the same
// column. Without that, the nav rows and the data rows above them — "Logged
// today" on the milk screen — are the same shape stacked with the same gap,
// and a worker scanning the screen gets no cue that the last two rows leave
// the page entirely. The separation lives here so every screen that renders
// this inherits it; no page overrides it.

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

type ModuleNavProps = {
  assignedModules: readonly Module[]
  /** The screen being viewed, so it isn't offered as somewhere to go. */
  current: Module
  treatment: "owner" | "worker"
}

/**
 * Links to the other modules this user is offered.
 *
 * Renders nothing at all when there is nowhere to go — a worker narrowed to a
 * single module, or every other module still unbuilt — rather than an empty
 * heading over a blank space.
 */
export function ModuleNav({
  assignedModules,
  current,
  treatment,
}: ModuleNavProps) {
  const worker = treatment === "worker"

  // A module with no screen yet (Shop) is filtered out here rather than
  // rendered disabled: a dead row invites a tap that does nothing.
  const destinations = modulesFor(assignedModules).filter(
    (module) => module.value !== current && module.href !== null
  )

  if (destinations.length === 0) return null

  return (
    <nav
      aria-label="Other modules"
      className={cn(
        // The rule is what separates navigation from content. 2px on a worker
        // screen and 1px on the owner's, matching the panel edges either role
        // already sees in `ui-context.md`'s treatment table.
        "flex flex-col border-t border-border",
        worker ? "mt-4 gap-4 border-t-2 pt-8" : "mt-2 gap-3 pt-6"
      )}
    >
      {/* Deliberately quieter than the "Logged today" heading above it: this
          labels a way out of the screen, not another section of its data. */}
      <h2
        className={cn(
          "font-medium text-muted-foreground",
          worker ? "text-base" : "text-sm"
        )}
      >
        Other modules
      </h2>

      {/* The rows themselves are untouched — icon, label and chevron are
          exactly as they were; only their grouping changed. */}
      <div className="flex flex-col gap-3">
        {destinations.map((module) => {
          const Icon = ICONS[module.value]

          return (
            <Link
              key={module.value}
              href={module.href as string}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl bg-card transition-colors hover:border-foreground/30",
                worker
                  ? "border-2 border-border p-5"
                  : "border border-border p-4 shadow-sm"
              )}
            >
              <span className="flex items-center gap-3">
                <Icon
                  className={cn("h-5 w-5", ACCENT_TEXT[module.accent])}
                  aria-hidden
                />
                <span
                  className={cn(
                    "font-semibold",
                    worker ? "text-lg" : "text-base"
                  )}
                >
                  {module.label}
                </span>
              </span>
              <ChevronRightIcon
                className="h-5 w-5 text-muted-foreground"
                aria-hidden
              />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
