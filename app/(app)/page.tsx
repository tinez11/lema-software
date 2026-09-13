import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { ChevronRightIcon, MilkIcon, SproutIcon } from "lucide-react"
import type { MilkSession } from "@prisma/client"

import { MilkEntryForm } from "@/components/farm/milk-entry-form"
import { MilkHistoryList } from "@/components/farm/milk-history-list"
import type { MilkHistoryEntry } from "@/components/farm/milk-history-list"
import { WorkerPinList } from "@/components/farm/worker-pin-list"
import type { CurrentUser } from "@/lib/auth/session"
import { resolveAuthGate } from "@/lib/auth/session"
import { cn } from "@/lib/utils"
import { farmDate } from "@/lib/db/dates"
import { getMilkRecordsForDate, getRecentMilkRecords } from "@/lib/db/milk"
import type { MilkRecordWithRecorder } from "@/lib/db/milk"

// Home routes on role, and for now both roles land in Cows & Milk — it is the
// only module with a write path. The worker gets the entry screen itself, with
// no dashboard and nothing to switch to; the owner gets the module home, which
// is the same form plus everyone's history.
//
// The full three-module dashboard is deliberately not here. It needs Land &
// Produce and Shop to have write paths of their own first, so building it now
// would mean two-thirds of it pointing at nothing.

/**
 * Dates are formatted in UTC on purpose. `MilkRecord.date` is a Postgres
 * `date`, which Prisma reads back as midnight UTC, and `farmDate()` writes it
 * from the server's civil day — so UTC is the only frame in which a stored
 * date formats back to the day it was logged.
 */
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

/** Morning until mid-afternoon, evening after — the entry most likely next. */
function sessionForNow(at: Date = new Date()): MilkSession {
  return at.getHours() < 14 ? "MORNING" : "EVENING"
}

/**
 * The way to the other module with a write path.
 *
 * `project-overview.md` says a worker opens straight onto "their assigned
 * module" with no module switching — but `User` has no assigned-module column,
 * so there is nothing to route on, and without a link a worker could not reach
 * the harvest screen at all. Until that column exists, every worker can reach
 * both. Deliberately one link rather than a dashboard. See open question 15.
 */
function LandLink({ treatment }: { treatment: "owner" | "worker" }) {
  const worker = treatment === "worker"

  return (
    <Link
      href="/land"
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl bg-card transition-colors hover:border-gold",
        worker ? "border-2 border-border p-5" : "border border-border p-4 shadow-sm"
      )}
    >
      <span className="flex items-center gap-3">
        <SproutIcon className="h-5 w-5 text-gold" aria-hidden />
        <span className={cn("font-semibold", worker ? "text-lg" : "text-base")}>
          Land &amp; Produce
        </span>
      </span>
      <ChevronRightIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
    </Link>
  )
}

function toHistoryEntry(
  record: MilkRecordWithRecorder,
  viewerId: string,
  today: Date
): MilkHistoryEntry {
  return {
    id: record.id,
    session: record.session,
    liters: record.liters,
    dateLabel: shortDayFormat.format(record.date),
    recordedByName: record.recordedBy.name,
    // The same two conditions `updateMilkRecord` enforces, asked here only so
    // the list doesn't offer a button the server would refuse.
    editable:
      record.recordedById === viewerId &&
      record.date.getTime() === today.getTime(),
  }
}

export default async function Home() {
  const gate = await resolveAuthGate()

  // The route-group layout has already redirected or explained every other
  // state; this narrows the type rather than re-deciding anything.
  if (gate.state !== "ready") return null

  return gate.user.role === "OWNER" ? (
    <OwnerMilkHome user={gate.user} />
  ) : (
    <WorkerMilkEntry user={gate.user} />
  )
}

async function WorkerMilkEntry({ user }: { user: CurrentUser }) {
  const today = farmDate()
  const mine = await getMilkRecordsForDate(today, { recordedById: user.id })

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b-2 border-border px-5 py-4">
        <span className="text-lg font-semibold">{user.name}</span>
        <UserButton />
      </header>

      <main className="flex w-full max-w-xl flex-1 flex-col gap-8 self-center p-5">
        <MilkEntryForm
          treatment="worker"
          dateLabel={dayFormat.format(today)}
          defaultSession={sessionForNow()}
          loggedSessions={mine.map((record) => record.session)}
        />

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Logged today</h2>
          <MilkHistoryList
            treatment="worker"
            entries={mine.map((record) =>
              toHistoryEntry(record, user.id, today)
            )}
            emptyMessage="Nothing logged yet today."
          />
        </section>

        <LandLink treatment="worker" />
      </main>
    </div>
  )
}

async function OwnerMilkHome({ user }: { user: CurrentUser }) {
  const today = farmDate()

  // Two reads rather than one filtered in memory: "what is already in today's
  // slots" and "what has been logged lately" are different questions, and the
  // recent list is capped.
  const [todaysRecords, recent] = await Promise.all([
    getMilkRecordsForDate(today),
    getRecentMilkRecords({ take: 20 }),
  ])

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-lg font-semibold">Farm &amp; Shop Manager</span>
        {/* Sign-out lands on /signed-out (set on ClerkProvider), which clears
            the PIN unlock cookie before handing over to the sign-in page. */}
        <UserButton />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-sm font-medium text-moss">
            <MilkIcon className="h-4 w-4" aria-hidden />
            Cows &amp; Milk
          </span>
          <h1 className="text-2xl font-semibold">Milk production</h1>
          <p className="text-sm text-muted-foreground">
            One herd total per session. Land &amp; Produce and Shop join the
            dashboard once they can be written to as well.
          </p>
        </div>

        <MilkEntryForm
          treatment="owner"
          dateLabel={dayFormat.format(today)}
          defaultSession={sessionForNow()}
          loggedSessions={todaysRecords.map((record) => record.session)}
        />

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Recent entries</h2>
          <MilkHistoryList
            treatment="owner"
            showRecorder
            showDate
            entries={recent.map((record) =>
              toHistoryEntry(record, user.id, today)
            )}
            emptyMessage="No milk has been logged yet."
          />
        </section>

        <LandLink treatment="owner" />

        {/* Kept from the auth unit: a forgotten PIN has no other way out, and
            this is still the owner's only screen. */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Worker PINs</h2>
          <p className="text-sm text-muted-foreground">
            Resetting clears a worker&apos;s PIN and any lockout. They choose a
            new one the next time they open the app.
          </p>
          <WorkerPinList />
        </section>
      </main>
    </div>
  )
}
