import { formatCents } from "@/lib/money"
import { cn } from "@/lib/utils"

// Recent sales. A server component: nothing here is interactive, and a sale is
// never edited — a cash mistake is corrected by a stock adjustment, not by
// rewriting what was rung up.
//
// `totalCents` is optional and the page only passes it for an owner. That is
// invariant 2 at the last mile: a worker sees what left the shop, the owner
// sees what came in for it.

export type SaleHistoryLine = {
  id: string
  name: string
  quantity: number
  unit: string
}

export type SaleHistoryRow = {
  id: string
  dateLabel: string
  recordedByName: string
  lines: readonly SaleHistoryLine[]
  /** Owner-only. Absent for a worker, and absent means absent — not zero. */
  totalCents?: number
}

type SalesHistoryListProps = {
  sales: readonly SaleHistoryRow[]
  emptyMessage: string
  treatment: "owner" | "worker"
}

/**
 * Recent sales, already shaped by the page.
 *
 * A row shows a total only when the page passed one, which it does only for an
 * owner. That is invariant 2 at the last mile — and `totalCents` being absent
 * rather than zero is the point: a worker's row has no total, which is not the
 * same as a sale that took nothing.
 */
export function SalesHistoryList({
  sales,
  emptyMessage,
  treatment,
}: SalesHistoryListProps) {
  const worker = treatment === "worker"

  if (sales.length === 0) {
    return (
      <p className={cn("text-muted-foreground", worker ? "text-base" : "text-sm")}>
        {emptyMessage}
      </p>
    )
  }

  return (
    <ul className={cn("flex flex-col", worker ? "gap-3" : "gap-2")}>
      {sales.map((sale) => (
        <li
          key={sale.id}
          className={cn(
            "flex flex-col gap-2 rounded-xl bg-card p-4",
            worker ? "border-2 border-border" : "border border-border shadow-sm"
          )}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className={cn("font-semibold", worker ? "text-base" : "text-sm")}>
              {sale.dateLabel}
              <span className="font-normal text-muted-foreground">
                {" · "}
                {sale.recordedByName}
              </span>
            </span>
            {sale.totalCents !== undefined && (
              <span
                className={cn(
                  "font-semibold tabular-nums text-ochre",
                  worker ? "text-xl" : "text-lg"
                )}
              >
                {formatCents(sale.totalCents)}
              </span>
            )}
          </div>

          <ul className="flex flex-col gap-1">
            {sale.lines.map((line) => (
              <li
                key={line.id}
                className="flex justify-between gap-3 text-sm text-muted-foreground"
              >
                <span>{line.name}</span>
                <span className="tabular-nums">
                  {line.quantity} {line.unit}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
