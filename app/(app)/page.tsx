import { UserButton } from "@clerk/nextjs"
import { redirect } from "next/navigation"

import { AuthNotice } from "@/components/farm/auth-notice"
import { MetricCard } from "@/components/farm/metric-card"
import { NeedsAttentionList } from "@/components/farm/needs-attention-list"
import type { NeedsAttentionItem } from "@/components/farm/needs-attention-list"
import { WorkerPinList } from "@/components/farm/worker-pin-list"
import type { CurrentUser } from "@/lib/auth/session"
import { resolveAuthGate } from "@/lib/auth/session"
import { farmDate } from "@/lib/db/dates"
import { getRecentHarvestSummary } from "@/lib/db/land"
import { getTodayMilkTotal } from "@/lib/db/milk"
import {
  getLowStockItems,
  getTodaySalesSummaryWithFinancials,
} from "@/lib/db/shop"
import { landingHrefFor } from "@/lib/modules"
import { formatCents } from "@/lib/money"

// `/` is a role branch and nothing else.
//
// It used to *be* the milk screen, which meant a worker assigned only LAND or
// only SHOP still landed on milk and had to find their way out through the nav
// — the assignment existed in the schema and the landing ignored it. The owner
// gets the three-module dashboard; a worker is sent to the first module they
// are actually assigned.

/** How far back the Land card looks. A harvest is not a daily event. */
const HARVEST_WINDOW_DAYS = 7

export default async function Home() {
  const gate = await resolveAuthGate()

  // The route-group layout has already redirected or explained every other
  // state; this narrows the type rather than re-deciding anything.
  if (gate.state !== "ready") return null

  if (gate.user.role === "OWNER") return <OwnerDashboard user={gate.user} />

  const href = landingHrefFor(gate.user.assignedModules)

  // Nothing to send them to: an assignment naming only modules without a
  // route. An explanation, not a redirect into a 404.
  if (!href) {
    return (
      <AuthNotice title="Nothing assigned">
        You&apos;re not assigned to a module yet. Ask the owner to give you one
        — they set who works on what.
      </AuthNotice>
    )
  }

  // Outside any try/catch: `redirect` works by throwing. See
  // `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`.
  redirect(href)
}

/**
 * The owner's home: one card per module, what needs attention across all
 * three, and the worker PIN controls.
 *
 * Wider than every other screen — `max-w-5xl` against the `max-w-2xl` the
 * owner's module screens use — because this is the one screen `ui-context.md`
 * describes as a 3-across grid, and three cards in a phone-width column are
 * just a list. Worker screens stay a centred phone column; see `ui-context.md`,
 * "Viewport".
 */
async function OwnerDashboard({ user }: { user: CurrentUser }) {
  const today = farmDate()
  const harvestFrom = new Date(today)
  harvestFrom.setUTCDate(harvestFrom.getUTCDate() - HARVEST_WINDOW_DAYS)

  // Every figure on this page is read here, so the components stay
  // presentational and the owner-only call sites are all visible in one place.
  // `getTodaySalesSummaryWithFinancials` is privileged; the role was checked
  // by the caller above.
  const [milk, harvest, shop, lowStock] = await Promise.all([
    getTodayMilkTotal(today),
    getRecentHarvestSummary({ from: harvestFrom }),
    getTodaySalesSummaryWithFinancials(),
    getLowStockItems(),
  ])

  const headlineHarvest = harvest.totals[0]

  const attention: NeedsAttentionItem[] = lowStock.map((item) => ({
    id: item.id,
    module: "SHOP" as const,
    title: item.name,
    detail: `${item.quantity} ${item.unit} left, alerts under ${item.lowStockThreshold}`,
  }))

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-lg font-semibold">{user.name}</span>
        <UserButton />
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold">Today</h1>

        {/* One column on a phone, three across once there is room — the grid
            `ui-context.md` describes, and the only screen that widens. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricCard
            module="MILK"
            value={`${milk.liters} L`}
            detail={
              milk.entries === 1
                ? "1 entry today"
                : `${milk.entries} entries today`
            }
          />
          <MetricCard
            module="LAND"
            value={
              headlineHarvest
                ? `${headlineHarvest.quantity} ${headlineHarvest.unit}`
                : "—"
            }
            detail={`${harvest.entries} harvests in ${HARVEST_WINDOW_DAYS} days`}
          />
          <MetricCard
            module="SHOP"
            value={formatCents(shop.revenueCents)}
            detail={
              shop.sales === 1 ? "1 sale today" : `${shop.sales} sales today`
            }
          />
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Needs attention</h2>
          <NeedsAttentionList items={attention} />
        </section>

        {/* Kept from the auth unit, and still the only route out of a
            forgotten PIN. Open question 19's assignment control belongs here
            too, when it is built. */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Worker access</h2>
          <p className="text-sm text-muted-foreground">
            A new account has no access until you approve it — signing up in
            Clerk does not grant any on its own. Resetting a PIN clears it and
            any lockout; they choose a new one the next time they open the app.
          </p>
          <WorkerPinList />
        </section>
      </main>
    </div>
  )
}
