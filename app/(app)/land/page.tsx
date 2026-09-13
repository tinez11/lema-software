import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { ArrowLeftIcon, SproutIcon } from "lucide-react"

import { CropCycleForm } from "@/components/farm/crop-cycle-form"
import { FieldForm } from "@/components/farm/field-form"
import { HarvestEntryForm } from "@/components/farm/harvest-entry-form"
import type { CropCycleOption } from "@/components/farm/harvest-entry-form"
import { HarvestHistoryList } from "@/components/farm/harvest-history-list"
import type { HarvestHistoryEntry } from "@/components/farm/harvest-history-list"
import { resolveAuthGate } from "@/lib/auth/session"
import { farmDate, toDateInputValue } from "@/lib/db/dates"
import {
  getCropCyclesForSelection,
  getFields,
  getHarvestHistory,
} from "@/lib/db/land"
import type { CropCycleForSelection } from "@/lib/db/land"

// Land & Produce. Both roles log a harvest; only the owner sets up the fields
// and crop cycles those harvests are logged against.
//
// `InputRecord` — cost entry and the cost-vs-yield reporting it feeds — is
// deliberately absent. It is the module's only money-bearing model, and it
// forces open question 6 (how a `Decimal` crosses the server/client boundary),
// which Shop needs answered too. That gets settled once, in whichever of those
// two units is built next.

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

export default async function LandPage() {
  const gate = await resolveAuthGate()

  // The route-group layout has already redirected or explained every other
  // state; this narrows the type rather than re-deciding anything.
  if (gate.state !== "ready") return null

  const owner = gate.user.role === "OWNER"
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
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold hover:text-gold"
        >
          <ArrowLeftIcon className="h-5 w-5" aria-hidden />
          Back
        </Link>
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

        {owner && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Setup</h2>
            <p className="text-sm text-muted-foreground">
              Fields and crop cycles are yours to create. Workers log harvests
              against them but cannot add either.
            </p>
            <FieldForm />
            <CropCycleForm
              fields={fields.map((field) => ({
                id: field.id,
                label: field.name,
              }))}
              todayValue={toDateInputValue(today)}
            />
          </section>
        )}
      </main>
    </div>
  )
}
