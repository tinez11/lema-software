"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createStockItemAction } from "@/app/(app)/shop/actions"
import { MAX_STOCK_NAME_LENGTH } from "@/lib/shop-config"

// Owner-only catalogue entry, in the owner treatment — the same arrangement as
// `field-form.tsx` and `crop-cycle-form.tsx`: hidden from workers, and refused
// by the action besides.
//
// A new item starts at zero stock. Putting it on the shelf is a separate,
// explicit restock, which is invariant 3 — the shop's stock is never inferred
// from anything.

/**
 * Reads a typed amount ("12.50", "12,50", "12") as whole cents.
 *
 * This is the one place a float touches money, and it is immediately rounded
 * to an integer: `12.10 * 100` is 1209.9999999999998 in binary floating point,
 * which is exactly why nothing downstream is allowed to work in units.
 * Returns null for anything that is not an amount, so the caller can say so
 * rather than sending NaN to the server.
 */
function parsePriceToCents(input: string): number | null {
  const trimmed = input.trim().replace(",", ".")

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null

  return Math.round(Number(trimmed) * 100)
}

/**
 * Owner-only form for adding something to the shop's catalogue. The price is
 * typed in whole units and leaves as cents.
 */
export function StockItemForm() {
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [unit, setUnit] = useState("")
  const [price, setPrice] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [pending, startTransition] = useTransition()

  const ready = name.trim() !== "" && unit.trim() !== "" && price.trim() !== ""

  /** Sends the form and turns each typed result into something to read. */
  function save() {
    if (!ready || pending) return

    setFeedback(null)

    const priceCents = parsePriceToCents(price)

    if (priceCents === null) {
      setFailed(true)
      setFeedback("Enter the price as an amount, like 12.50.")
      return
    }

    startTransition(async () => {
      try {
        const result = await createStockItemAction({
          name,
          category,
          unit,
          priceCents,
        })

        switch (result.status) {
          case "ok":
            setName("")
            setCategory("")
            setUnit("")
            setPrice("")
            setFailed(false)
            setFeedback(`${result.name} added, starting at zero stock.`)
            return
          case "not-owner":
            setFailed(true)
            setFeedback("Only the owner can add stock items.")
            return
          case "invalid":
            setFailed(true)
            setFeedback(result.message)
            return
          case "not-allowed":
            setFailed(true)
            setFeedback("You're not signed in. Open the app again.")
            return
        }
      } catch {
        setFailed(true)
        setFeedback("No connection — the item wasn't saved.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-base font-semibold">Add a stock item</h3>

      <div className="flex flex-col gap-2">
        <Label htmlFor="stock-name">Name</Label>
        <Input
          id="stock-name"
          value={name}
          maxLength={MAX_STOCK_NAME_LENGTH}
          onChange={(event) => setName(event.target.value)}
          placeholder="Sugar 1kg"
          disabled={pending}
          className="h-11 rounded-lg"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="stock-unit">Sold by</Label>
        <Input
          id="stock-unit"
          value={unit}
          maxLength={32}
          onChange={(event) => setUnit(event.target.value)}
          placeholder="each, kg, bag"
          disabled={pending}
          className="h-11 rounded-lg"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="stock-price">Price per unit</Label>
        <Input
          id="stock-price"
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="12.50"
          disabled={pending}
          className="h-11 rounded-lg"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="stock-category">Category (optional)</Label>
        <Input
          id="stock-category"
          value={category}
          maxLength={MAX_STOCK_NAME_LENGTH}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Dry goods"
          disabled={pending}
          className="h-11 rounded-lg"
        />
      </div>

      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className={failed ? "text-sm text-destructive" : "text-sm text-ochre"}
        >
          {feedback}
        </p>
      )}

      <Button
        onClick={save}
        disabled={!ready || pending}
        className="self-start rounded-lg"
      >
        {pending ? "Adding…" : "Add item"}
      </Button>
    </div>
  )
}
