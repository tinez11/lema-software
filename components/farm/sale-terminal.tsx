"use client"

import { useMemo, useState, useTransition } from "react"
import { AlertTriangleIcon, CheckCircle2Icon, Trash2Icon, WifiOffIcon } from "lucide-react"

import { QuantityStepper } from "@/components/farm/quantity-stepper"
import { StockItemGrid } from "@/components/farm/stock-item-grid"
import type { SellableItem } from "@/components/farm/stock-item-grid"
import { Button } from "@/components/ui/button"
import { recordSaleAction } from "@/app/(app)/shop/actions"
import { formatCents } from "@/lib/money"
import {
  MAX_SALE_QUANTITY,
  SALE_QUANTITY_DECIMALS,
  SALE_QUANTITY_STEP,
} from "@/lib/shop-config"
import { cn } from "@/lib/utils"

// The POS screen from `ui-context.md`: a tappable item grid, a running sale
// summary with a stepper per line, and a sticky checkout at the bottom.
//
// The cart lives here and nowhere else — no draft is persisted. An interrupted
// cash sale is re-rung, which is what happens at a till anyway; persisting a
// half-finished sale would leave stock ambiguously committed.
//
// Every amount on this screen is an integer number of cents. The only division
// is inside `formatCents`, at the moment a string is rendered.

type CartLine = {
  item: SellableItem
  quantity: number
}

type Feedback =
  | { kind: "idle" }
  | { kind: "sold"; message: string }
  | { kind: "blocked"; message: string }
  | { kind: "offline" }

type SaleTerminalProps = {
  items: readonly SellableItem[]
  treatment: "owner" | "worker"
}

/**
 * The till: item grid, current sale, sticky total and checkout.
 *
 * Holds the cart and nothing else — no stock is reserved while a sale is being
 * rung, so the shelf is only committed at checkout, by the conditional
 * decrement in `recordSale`. The remaining-stock figure on each tile is a
 * courtesy, not a lock: the server is what refuses an oversell.
 */
export function SaleTerminal({ items, treatment }: SaleTerminalProps) {
  const worker = treatment === "worker"

  const [cart, setCart] = useState<CartLine[]>([])
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" })
  const [pending, startTransition] = useTransition()

  const totalCents = useMemo(
    () =>
      cart.reduce(
        // The same per-line rounding `recordSale` applies, so the total shown
        // at the till is the total the server computes — a running figure that
        // disagrees with the receipt by a cent is worse than no figure.
        (sum, line) => sum + Math.round(line.item.unitPriceCents * line.quantity),
        0
      ),
    [cart]
  )

  const inCart = useMemo(
    () => Object.fromEntries(cart.map((line) => [line.item.id, line.quantity])),
    [cart]
  )

  /** Tapping a tile adds one, or bumps the line that is already on the sale. */
  function add(item: SellableItem) {
    setFeedback({ kind: "idle" })
    setCart((current) => {
      const existing = current.find((line) => line.item.id === item.id)

      if (!existing) return [...current, { item, quantity: 1 }]

      return current.map((line) =>
        line.item.id === item.id
          ? { ...line, quantity: line.quantity + 1 }
          : line
      )
    })
  }

  /** A line dropped to zero leaves the sale rather than sitting there at nought. */
  function setQuantity(itemId: string, quantity: number) {
    setFeedback({ kind: "idle" })
    setCart((current) =>
      quantity <= 0
        ? current.filter((line) => line.item.id !== itemId)
        : current.map((line) =>
            line.item.id === itemId ? { ...line, quantity } : line
          )
    )
  }

  /** Drops a line from the sale outright, whatever quantity it held. */
  function remove(itemId: string) {
    setFeedback({ kind: "idle" })
    setCart((current) => current.filter((line) => line.item.id !== itemId))
  }

  /** Sends the sale and turns each typed result into something to read. */
  function checkout() {
    if (cart.length === 0 || pending) return

    setFeedback({ kind: "idle" })

    startTransition(async () => {
      try {
        const result = await recordSaleAction({
          lines: cart.map((line) => ({
            stockItemId: line.item.id,
            quantity: line.quantity,
          })),
        })

        switch (result.status) {
          case "ok":
            setCart([])
            setFeedback({
              kind: "sold",
              message: `Sale recorded — ${formatCents(result.totalCents)} taken.`,
            })
            return
          case "insufficient-stock":
            setFeedback({
              kind: "blocked",
              message:
                `Not enough ${result.name}: ${result.available} left, ` +
                `${result.requested} on the sale. Nothing was recorded — ` +
                `adjust the line and ring it again.`,
            })
            return
          case "unknown-item":
            setFeedback({
              kind: "blocked",
              message:
                "One of these items is no longer stocked. Reload the till and ring it again.",
            })
            return
          case "busy":
            setFeedback({
              kind: "blocked",
              message:
                "Another till was using these items. Nothing was recorded — ring it again.",
            })
            return
          case "empty-sale":
            setFeedback({ kind: "blocked", message: "There's nothing on the sale." })
            return
          case "invalid":
            setFeedback({ kind: "blocked", message: result.message })
            return
          case "not-allowed":
            setFeedback({
              kind: "blocked",
              message: "You're not signed in to take a sale. Open the app again.",
            })
            return
        }
      } catch {
        setFeedback({ kind: "offline" })
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className={cn("font-semibold", worker ? "text-lg" : "text-base")}>
          Items
        </h2>
        <StockItemGrid
          items={items}
          inCart={inCart}
          onAdd={add}
          disabled={pending}
        />
      </section>

      <section
        className={cn(
          "flex flex-col gap-4 rounded-2xl bg-card",
          worker
            ? "border-2 border-border p-5"
            : "border border-border p-6 shadow-sm"
        )}
      >
        <h2 className={cn("font-semibold", worker ? "text-xl" : "text-lg")}>
          Current sale
        </h2>

        {cart.length === 0 ? (
          <p className="text-base text-muted-foreground">
            Tap an item above to start a sale.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {cart.map((line) => (
              <li key={line.item.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-base font-semibold">
                    {line.item.name}
                    <span className="font-normal text-muted-foreground">
                      {" · "}
                      {formatCents(line.item.unitPriceCents)} / {line.item.unit}
                    </span>
                  </span>
                  <span className="text-lg font-semibold tabular-nums text-ochre">
                    {formatCents(
                      Math.round(line.item.unitPriceCents * line.quantity)
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <QuantityStepper
                    value={line.quantity}
                    onValueChange={(next) => setQuantity(line.item.id, next)}
                    step={SALE_QUANTITY_STEP}
                    min={0}
                    max={Math.min(MAX_SALE_QUANTITY, line.item.quantity)}
                    decimals={SALE_QUANTITY_DECIMALS}
                    unit={line.item.unit}
                    label={`Quantity of ${line.item.name}`}
                    disabled={pending}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    onClick={() => remove(line.item.id)}
                    disabled={pending}
                    aria-label={`Remove ${line.item.name} from the sale`}
                    className="h-14 w-14 shrink-0 rounded-xl"
                  >
                    <Trash2Icon className="h-5 w-5" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {feedback.kind !== "idle" && <FeedbackNote feedback={feedback} />}
      </section>

      {/* Sticky, per ui-context.md: at a till the total and the way to finish
          have to stay on screen while the list above it grows. */}
      <div className="sticky bottom-0 -mx-5 flex flex-col gap-3 border-t-2 border-border bg-background px-5 py-4 sm:mx-0 sm:rounded-2xl sm:border-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-lg font-semibold">Total</span>
          <span className="text-3xl font-semibold tabular-nums text-ochre">
            {formatCents(totalCents)}
          </span>
        </div>
        <Button
          onClick={checkout}
          disabled={cart.length === 0 || pending}
          className="h-14 w-full rounded-xl text-lg font-semibold"
        >
          {pending ? "Recording…" : "Take payment"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Cash only — no account or change is recorded.
        </p>
      </div>
    </div>
  )
}

/** The one-line result of a checkout: what happened, and whether it worked. */
function FeedbackNote({
  feedback,
}: {
  feedback: Exclude<Feedback, { kind: "idle" }>
}) {
  const sold = feedback.kind === "sold"

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 rounded-xl border-2 p-4 text-base",
        sold ? "border-ochre/40" : "border-destructive/50"
      )}
    >
      {sold ? (
        <CheckCircle2Icon className="mt-0.5 h-5 w-5 shrink-0 text-ochre" aria-hidden />
      ) : feedback.kind === "offline" ? (
        <WifiOffIcon className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
      ) : (
        <AlertTriangleIcon
          className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
          aria-hidden
        />
      )}
      {feedback.kind === "offline"
        ? "No connection — the sale wasn't recorded, and no stock was taken off. Ring it again once you're back online."
        : feedback.message}
    </p>
  )
}
