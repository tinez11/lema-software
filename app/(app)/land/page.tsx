import { UserButton } from "@clerk/nextjs"
import { SproutIcon } from "lucide-react"

import { CostVsYieldSummary } from "@/components/farm/cost-vs-yield-summary"
import type { CostVsYieldEntry } from "@/components/farm/cost-vs-yield-summary"
import { CropCycleForm } from "@/components/farm/crop-cycle-form"
import { FieldForm } from "@/components/farm/field-form"
import { HarvestEntryForm } from "@/components/farm/harvest-entry-form"
import type { CropCycleOption } from "@/components/farm/harvest-entry-form"
import { HarvestHistoryList } from "@/components/farm/harvest-history-list"
import { InputCostForm } from "@/components/farm/input-cost-form"
import { ModuleNav } from "@/components/farm/module-nav"
import type { HarvestHistoryEntry } from "@/components/farm/harvest-history-list"
import { AuthNotice } from "@/components/farm/auth-notice"
import { requireModule, requireOwner } from "@/lib/auth/roles"
import { resolveAuthGate } from "@/lib/auth/session"
import { farmDate, toDateInputValue } from "@/lib/db/dates"
import {
  getCostVsYieldWithFinancials,
  getCropCyclesForSelection,
  getFields,
  getHarvestHistory,
} from "@/lib/db/land"
import type { CropCycleForSelection } from "@/lib/db/land"

// Land & Produce. Both roles log a harvest; only the owner sets up the fields
// and crop cycles those harvests are logged against, logs what the inputs cost,
// and sees the cost-vs-yield summaries.
//
// Cost is invariant 2 at the read end. `getCostVsYieldWithFinancials()` is only
// reached through the `requireOwner()` branch below, so a worker's render never
// runs the query — the figure is absent from the payload, not hidden in it with
// CSS. That is the same reason the shop screen splits its history reads.

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
})

const shortDayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
})

/** "Maize · North paddock" — how a cycle is named everywhere on this screen. */
function cycleLabel(cycle: CropCycleForSelection): string {
  return `${cycle.cropType} · ${cycle.field.name}`
}

/**
 * `/land` — the Land & Produce screen, for both roles.
 *
 * One page rather than two: the harvest form and history are identical for a
 * worker and the owner, and only the Setup section is gated. Splitting it by
 * role would mean two copies of the same reads drifting apart.
 */
export default async function LandPage() {
  const gate = await resolveAuthGate()

  // The route-group layout has already redirected or explained every other
  // state; this narrows the type rather than re-deciding anything.
  if (gate.state !== "ready") return null

  // A worker narrowed away from this module cannot reach it by typing the URL
  // either — the action refuses the write, and this refuses the read.
  if (!requireModule(gate, "LAND").ok) {
    return (
      <AuthNotice title="Not your module">
        You&apos;re not assigned to Land &amp; Produce. Ask the owner if that&apos;s
        wrong — they set who works on what.
      </AuthNotice>
    )
  }

  // Narrowed rather than read off the role directly, so the owner-only reads
  // below are gated by the same check the actions use. `owner` stays for the
  // density switches, which are presentation and not permission.
  const ownerCheck = requireOwner(gate)
  const owner = ownerCheck.ok
  const today = farmDate()

  const [cycles, harvests, fields] = await Promise.all([
    getCropCyclesForSelection(),
    getHarvestHistory(undefined, { take: 20 }),
    // Only the owner's setup form needs the field list, so a worker's render
    // does not pay for the query.
    owner ? getFields() : Promise.resolve([]),
  ])

  const cycleOptions: CropCycleOption[] = cycles.map((cycle) => ({
    id: cycle.id,
    label: cycleLabel(cycle),
  }))

  // One privileged read per cycle, and only inside the owner branch. A worker
  // reaching this line is impossible: `ownerCheck.ok` is false and the array
  // stays empty, so no cost is fetched, let alone serialised.
  //
  // Keyed by cycle id rather than by the label, because the label is not
  // unique — two cycles of the same crop in the same field read identically,
  // which is open question 17.
  const costVsYield = ownerCheck.ok
    ? await Promise.all(
        cycles.map(async (cycle) => ({
          id: cycle.id,
          summary: {
            cropLabel: cycleLabel(cycle),
            ...(await getCostVsYieldWithFinancials(cycle.id)),
          } satisfies CostVsYieldEntry,
        }))
      )
    : []

  const historyEntries: HarvestHistoryEntry[] = harvests.map((harvest) => ({
    id: harvest.id,
    dateLabel: shortDayFormat.format(harvest.date),
    quantity: harvest.quantity,
    unit: harvest.unit,
    cropLabel: `${harvest.cropCycle.cropType} · ${harvest.cropCycle.field.name}`,
    recordedByName: harvest.recordedBy.name,
  }))

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
          <span className="flex items-center gap-2 text-sm font-medium text-gold">
            <SproutIcon className="h-4 w-4" aria-hidden />
            Land &amp; Produce
          </span>
          <h1 className="text-2xl font-semibold">Harvests</h1>
        </div>

        <HarvestEntryForm
          treatment={owner ? "owner" : "worker"}
          dateLabel={dayFormat.format(today)}
          cycles={cycleOptions}
        />

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Recent harvests</h2>
          <HarvestHistoryList
            treatment={owner ? "owner" : "worker"}
            entries={historyEntries}
            emptyMessage="No harvests logged yet."
          />
        </section>

        {/* Owner-only, and above the nav because it is data about this module
            rather than a way out of it. */}
        {owner && costVsYield.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Cost vs. yield</h2>
            <p className="text-sm text-muted-foreground">
              What each cycle has cost in inputs, against what it has produced.
              Quantities are listed in the units they were logged in — kg and
              crates do not add up, so there is no single figure for both.
            </p>
            {costVsYield.map(({ id, summary }) => (
              <CostVsYieldSummary key={id} {...summary} />
            ))}
          </section>
        )}

        <ModuleNav
          assignedModules={gate.user.assignedModules}
          current="LAND"
          treatment={owner ? "owner" : "worker"}
        />

        {owner && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Setup</h2>
            <p className="text-sm text-muted-foreground">
              Fields, crop cycles and input costs are yours. Workers log
              harvests against them but cannot add any of the three, and never
              see a cost.
            </p>
            <FieldForm />
            <CropCycleForm
              fields={fields.map((field) => ({
                id: field.id,
                label: field.name,
              }))}
              todayValue={toDateInputValue(today)}
            />
            <InputCostForm cycles={cycleOptions} />
          </section>
        )}
      </main>
    </div>
  )
}
