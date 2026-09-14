"use client"

import { formatCents } from "@/lib/money"
import { cn } from "@/lib/utils"

// The quick-add grid at the top of the till: one tile per item, tap to put one
// on the sale.
//
// **Not `ChoiceGrid`.** The spec said to reuse it if it fits, and it does not:
// `ChoiceGrid` is a radio group — one value, exclusive, `checked` — while this
// is a row of actions that each add to a running cart, with no selected state
// at all. Bending it to do both would mean a mode flag that makes every
// existing caller read worse, which is forking by another name. `QuantityStepper`
// *is* reused, on each cart line, where the shape genuinely matches.

export type SellableItem = {
  id: string
  name: string
  unit: string
  quantity: number
  unitPriceCents: number
}

type StockItemGridProps = {
  items: readonly SellableItem[]
  /** Units already on the sale, so a tile can show what is left, not what is on the shelf. */
  inCart: Readonly<Record<string, number>>
  onAdd: (item: SellableItem) => void
  disabled?: boolean
}

/**
 * The quick-add grid: one tile per stock item, tap to add one to the sale.
 *
 * A tile disables itself once the cart holds everything on the shelf, so the
 * till stops offering what it cannot sell — but that is UI courtesy only, and
 * the server still refuses an oversell on its own terms.
 */
export function StockItemGrid({
  items,
  inCart,
  onAdd,
  disabled = false,
}: StockItemGridProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border-2 border-border p-4 text-base text-muted-foreground">
        Nothing is stocked yet. The owner adds items before anything can be
        sold.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => {
        // What is left once the current sale is accounted for. The server
        // still refuses an oversell — this only stops the till offering one.
        const remaining = item.quantity - (inCart[item.id] ?? 0)
        const soldOut = remaining < 1

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onAdd(item)}
            disabled={disabled || soldOut}
            className={cn(
              "flex min-h-24 flex-col items-start justify-between gap-1 rounded-xl border-2 border-border bg-card p-3 text-left transition-colors",
              "hover:border-ochre focus-visible:ring-3 focus-visible:ring-ring/50",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border"
            )}
          >
            <span className="text-base font-semibold text-foreground">
              {item.name}
            </span>
            <span className="flex w-full items-baseline justify-between gap-2">
              <span className="text-lg font-semibold tabular-nums text-ochre">
                {formatCents(item.unitPriceCents)}
              </span>
              <span className="text-sm text-muted-foreground">
                {soldOut ? "none left" : `${remaining} ${item.unit}`}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
