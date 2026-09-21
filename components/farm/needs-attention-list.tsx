import Link from "next/link"
import type { Module } from "@prisma/client"

import { moduleDefinition } from "@/lib/modules"
import { cn } from "@/lib/utils"

// The one cross-module list on the owner's dashboard: what wants doing,
// wherever it lives.
//
// Deliberately thin on sources. Low stock is the only alert with a real data
// source today — a shop item at or under its own threshold. Milk and land
// alerts arrive with the health-reminder and cost-vs-yield units; inventing
// them now would put a fabricated product fact on the owner's home screen,
// which `ai-workflow-rules.md` forbids.
//
// Takes already-shaped rows rather than reading the database itself, so the
// page owns every query and this file stays renderable from anywhere.

const ACCENT_BORDER = {
  moss: "border-l-moss",
  gold: "border-l-gold",
  ochre: "border-l-ochre",
} as const

export type NeedsAttentionItem = {
  id: string
  module: Module
  /** What it is — a stock item's name. */
  title: string
  /** Why it is here — "3 kg left, alerts under 10". */
  detail: string
}

/**
 * What needs the owner's attention, across all three modules.
 *
 * Renders an explicit "nothing needs attention" rather than an empty panel: a
 * blank space reads as a screen that failed to load, not as good news.
 */
export function NeedsAttentionList({
  items,
}: {
  items: readonly NeedsAttentionItem[]
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Nothing needs attention right now.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const definition = moduleDefinition(item.module)

        return (
          <li key={item.id}>
            <Link
              href={definition.href ?? "#"}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border border-l-4 border-border bg-card p-4 shadow-sm transition-colors hover:border-foreground/30",
                ACCENT_BORDER[definition.accent]
              )}
            >
              <span className="flex flex-col gap-1">
                <span className="font-semibold">{item.title}</span>
                <span className="text-sm text-muted-foreground">
                  {item.detail}
                </span>
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {definition.label}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
