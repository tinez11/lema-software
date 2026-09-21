import { formatCents } from "@/lib/money"

// Owner-only, one per crop cycle. Presentational: the page owns the read, and
// the read is the privileged `getCostVsYieldWithFinancials()`, so every call
// site sits behind the `requireOwner()` check in `app/(app)/land/page.tsx`
// rather than being hidden here.
//
// A server component with no `"use client"` — there is nothing interactive on
// it, and a cost figure has no business being shipped to a worker's bundle even
// unrendered.
//
// **No cost-per-unit figure, by design.** The money that went in is shown
// beside the quantities that came out, and the two are never divided. A cycle
// picked in both kg and bags has no single blended number that means anything,
// and computing one only when a single unit happens to be present would make a
// figure that silently disappears the first time a second unit is logged. The
// comparison is the point; the ratio would be an invented fact.

export type CostVsYieldEntry = {
  /** "Maize · North paddock", composed by the page. */
  cropLabel: string
  totalCostCents: number
  harvestByUnit: readonly { unit: string; quantity: number }[]
}

export function CostVsYieldSummary({
  cropLabel,
  totalCostCents,
  harvestByUnit,
}: CostVsYieldEntry) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-base font-semibold">{cropLabel}</h3>

      <dl className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-sm text-muted-foreground">Input cost</dt>
          <dd className="text-lg font-semibold tabular-nums text-gold">
            {formatCents(totalCostCents)}
          </dd>
        </div>

        <div className="flex flex-col gap-1">
          <dt className="text-sm text-muted-foreground">Harvested</dt>
          {harvestByUnit.length === 0 ? (
            <dd className="text-sm text-muted-foreground">
              Nothing harvested against this cycle yet.
            </dd>
          ) : (
            // One row per unit, never added together: kg and crates do not
            // sum, which is why the read groups them in the first place.
            harvestByUnit.map((total) => (
              <dd
                key={total.unit}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="text-sm">{total.unit}</span>
                <span className="text-lg font-semibold tabular-nums">
                  {total.quantity}
                </span>
              </dd>
            ))
          )}
        </div>
      </dl>

      {harvestByUnit.length > 1 && (
        <p className="text-sm text-muted-foreground">
          Harvested in more than one unit, so there is no single cost per unit
          to show — the totals are listed as they were logged.
        </p>
      )}
    </div>
  )
}
