Read `Agents.md` before starting

Were adding the third write path — shop stock and cash sales — plus
the two routing/serialization decisions Shop forces.

## Part 1 — the two blocking decisions

Add `enum Module { MILK LAND SHOP }` and `assignedModules Module[]
@default([])` to `User`. Migrate. Empty array means all three modules
— update both home screens to render one link per assigned module
(all three if the array is empty) instead of the hardcoded `/land`
link.

Add `lib/db/money.ts`: `toCents(d: Prisma.Decimal): number` and
`fromCents(cents: number): Prisma.Decimal`. Every financial field
crossing into or out of a server action goes through one of these —
never a raw `Decimal`, never a client-side float representing dollars.

## Part 2 — Shop

Add to `lib/db/shop.ts` (already has its read/`WithPricing` split from
`02-database`):
- `createStockItem(name, category, unit, priceCents, ownerId)` — owner
  only, checked by the caller via `requireOwner()`, not a role
  parameter. Converts `priceCents` to `Decimal` via `fromCents` before
  the insert.
- `recordSale(items: { stockItemId, quantity }[], recordedById)` —
  either role. Runs as a single transaction: for each line, a
  conditional `updateMany` decrementing `StockItem.quantity` with
  `where: { quantity: { gte: requestedQuantity } }`; if the affected
  count is 0, roll back and return a typed
  `{ ok: false, reason: "insufficient-stock", stockItemId }` rather
  than an exception — same shape as milk's duplicate and land's
  missing-foreign-key results. Only once every line succeeds does it
  create the `Sale` and its `SaleItem` rows, pricing each line from the
  stock item's *current* price at the moment of sale, not a
  client-supplied price.
- `getStockItemsForSale()` — id, name, unit, quantity, and price *in
  cents* via `toCents` — this is the one safe export that includes a
  financial figure, because a sale screen cannot function without a
  price to multiply against. This does not violate invariant 2:
  workers see the price of an item they are actively selling, not a
  cost, margin, or revenue total.
- `getSalesHistory()` — no financial fields, quantities and item names
  only; the owner-only revenue view is a `...WithFinancials()` twin
  added alongside it.

Add `app/(app)/shop/actions.ts` — `createStockItemAction` (owner-gated,
first statement, before validation, matching land's ordering) and
`recordSaleAction`. Both take and return cents, never `Decimal`.

Add `lib/shop-config.ts` for quantity bounds, following the
`milk-config.ts` / `land-config.ts` precedent.

Reuse `ChoiceGrid` for the item-quantity grid if it fits; do not fork
it if it doesn't — extend it the way harvest's unit picker did to
`SessionToggle`, rather than copying.

Build the sale screen for both roles (the item grid, running total,
checkout button from the shop mockup) and an owner-only stock-creation
form. No customer or credit fields anywhere — the shop is cash-only,
per `project-overview.md`.

Do not build the three-module owner dashboard yet — that's the next
unit, once this one is verified.

Do not modify `components/ui/*`.

### Check when done
- A worker cannot create a `StockItem`; the rejection happens before
  validation runs.
- Selling more of an item than is in stock is refused with the typed
  `insufficient-stock` reason, and no partial sale is created — verify
  this under concurrent requests the way the PIN attempt counter and
  milk's duplicate check were both verified, not just sequentially.
- A successful sale decrements stock by exactly the sold quantity and
  creates matching `SaleItem` rows priced from the stock item's price
  at sale time.
- No `Decimal` value is ever found in a client-rendered payload —
  everything financial is a plain integer (cents) by the time it
  leaves `lib/db/`.
- A worker whose `assignedModules` includes `SHOP` but not `LAND` sees
  only the shop link on their home screen.
- `npm run build` passes
- `npm run lint` passes