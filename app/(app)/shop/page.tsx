import { UserButton } from "@clerk/nextjs"
import { StoreIcon } from "lucide-react"

import { ModuleNav } from "@/components/farm/module-nav"
import { SaleTerminal } from "@/components/farm/sale-terminal"
import { SalesHistoryList } from "@/components/farm/sales-history-list"
import type { SaleHistoryRow } from "@/components/farm/sales-history-list"
import { StockItemForm } from "@/components/farm/stock-item-form"
import { AuthNotice } from "@/components/farm/auth-notice"
import { requireModule } from "@/lib/auth/roles"
import { resolveAuthGate } from "@/lib/auth/session"
import {
  getSalesHistory,
  getSalesHistoryWithFinancials,
  getStockItemsForSale,
} from "@/lib/db/shop"

// The Shop: a till both roles use, and an owner-only catalogue form.
//
// The role difference here is invariant 2, not decoration. Both roles get the
// same till — a sale screen needs the shelf price to work — but the history
// below it is read through two different helpers, and the worker's simply has
// no money in it. The choice is made once, below, and the two paths are two
// named exports rather than one helper taking a role.
//
// Nothing on this screen takes a customer, an account or a balance. The shop
// is cash-only (`project-overview.md`), so there is no such field to render.

/**
 * Whether this row came back from the privileged read.
 *
 * A type predicate rather than a cast: the two helpers return genuinely
 * different shapes, and the whole point of invariant 2's split is that the
 * compiler can tell them apart. A cast here would be asserting exactly the
 * thing the split exists to prove.
 */
function hasTotal(sale: object): sale is { totalAmountCents: number } {
  return "totalAmountCents" in sale
}

const saleTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

/**
 * `/shop` — the till, for both roles, plus the owner's catalogue form.
 *
 * `Sale.date` is a full timestamp rather than a `@db.Date`, so it is formatted
 * in the server's local zone and not forced through `lib/db/dates.ts` — a cash
 * sale happens at a moment, not on a civil day the way a milking or a harvest
 * does.
 *
 * "The server's zone" is the farm's only while this runs on a local machine,
 * the same caveat `farmDate()` carries. Both want one configured farm timezone
 * to read from, which is open question 12; a sale would then be stamped in the
 * farm's zone rather than the host's. Not invented here, because guessing a
 * timezone puts a wrong time on a receipt.
 */
export default async function ShopPage() {
  const gate = await resolveAuthGate()

  // The route-group layout has already redirected or explained every other
  // state; this narrows the type rather than re-deciding anything.
  if (gate.state !== "ready") return null

  // A worker narrowed away from this module cannot reach it by typing the URL
  // either — the action refuses the write, and this refuses the read.
  if (!requireModule(gate, "SHOP").ok) {
    return (
      <AuthNotice title="Not your module">
        You&apos;re not assigned to the Shop. Ask the owner if that&apos;s
        wrong — they set who works on what.
      </AuthNotice>
    )
  }

  const owner = gate.user.role === "OWNER"

  const [items, sales] = await Promise.all([
    getStockItemsForSale(),
    // The invariant 2 fork: the privileged twin is reachable only from this
    // branch, after the role has been checked.
    owner
      ? getSalesHistoryWithFinancials({ take: 20 })
      : getSalesHistory({ take: 20 }),
  ])

  const history: SaleHistoryRow[] = sales.map((sale) => {
    const row: SaleHistoryRow = {
      id: sale.id,
      dateLabel: saleTimeFormat.format(sale.date),
      recordedByName: sale.recordedBy.name,
      lines: sale.items.map((line) => ({
        id: line.id,
        name: line.stockItem.name,
        quantity: line.quantity,
        unit: line.stockItem.unit,
      })),
    }

    // The total exists only on the owner's read, and `totalCents` is left off
    // entirely rather than set to zero — a worker's row has no total, which is
    // not the same as a sale that took nothing.
    return hasTotal(sale) ? { ...row, totalCents: sale.totalAmountCents } : row
  })

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header
        className={
          owner
            ? "flex items-center justify-between border-b border-border px-6 py-4"
            : "flex items-center justify-between border-b-2 border-border px-5 py-4"
        }
      >
        <span className="text-lg font-semibold">
          {owner ? "Farm & Shop Manager" : gate.user.name}
        </span>
        <UserButton />
      </header>

      <main
        className={
          owner
            ? "mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6"
            : "flex w-full max-w-xl flex-1 flex-col gap-8 self-center p-5"
        }
      >
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-sm font-medium text-ochre">
            <StoreIcon className="h-4 w-4" aria-hidden />
            Shop
          </span>
          <h1 className="text-2xl font-semibold">Till</h1>
        </div>

        <SaleTerminal items={items} treatment={owner ? "owner" : "worker"} />

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Recent sales</h2>
          <SalesHistoryList
            sales={history}
            treatment={owner ? "owner" : "worker"}
            emptyMessage="No sales recorded yet."
          />
        </section>

        <ModuleNav
          assignedModules={gate.user.assignedModules}
          current="SHOP"
          treatment={owner ? "owner" : "worker"}
        />

        {owner && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Setup</h2>
            <p className="text-sm text-muted-foreground">
              Stock items are yours to create. Workers sell them but cannot add
              one or change a price.
            </p>
            <StockItemForm />
          </section>
        )}
      </main>
    </div>
  )
}
