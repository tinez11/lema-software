import { cn } from "@/lib/utils"

// A read-only list, so a server component — unlike `milk-history-list.tsx`,
// which is client-side because a worker can correct a milk entry on the day.
//
// There is no edit path here. `updateMilkRecord`'s own-and-recent rule was
// written for the milk slot; the equivalent for a harvest is a separate
// decision, and nothing in this unit asked for one.

export type HarvestHistoryEntry = {
  id: string
  /** Formatted server-side, in the civil day the record was stored under. */
  dateLabel: string
  quantity: number
  unit: string
  cropLabel: string
  recordedByName: string
}

type HarvestHistoryListProps = {
  entries: readonly HarvestHistoryEntry[]
  emptyMessage: string
  treatment: "owner" | "worker"
}

export function HarvestHistoryList({
  entries,
  emptyMessage,
  treatment,
}: HarvestHistoryListProps) {
  const worker = treatment === "worker"

  if (entries.length === 0) {
    return (
      <p className={cn("text-muted-foreground", worker ? "text-base" : "text-sm")}>
        {emptyMessage}
      </p>
    )
  }

  return (
    <ul className={cn("flex flex-col", worker ? "gap-3" : "gap-2")}>
      {entries.map((entry) => (
        <li
          key={entry.id}
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4",
            worker ? "border-2 border-border" : "border border-border shadow-sm"
          )}
        >
          <div className="flex flex-col">
            <span className={cn("font-semibold", worker ? "text-lg" : "text-base")}>
              {entry.cropLabel}
              <span className="font-normal text-muted-foreground">
                {" · "}
                {entry.dateLabel}
              </span>
            </span>
            <span className="text-sm text-muted-foreground">
              Logged by {entry.recordedByName}
            </span>
          </div>

          <span
            className={cn(
              "font-semibold tabular-nums text-gold",
              worker ? "text-2xl" : "text-xl"
            )}
          >
            {entry.quantity} {entry.unit}
          </span>
        </li>
      ))}
    </ul>
  )
}
