# Owner Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three-module owner dashboard at `/`, extract the Cows & Milk screen to its own `/milk` route, and replace `/`'s hardcoded milk landing with routing that respects `User.assignedModules`.

**Architecture:** `/` becomes a role branch only — the owner gets a new dashboard (three module metric cards plus one cross-module needs-attention list), a worker is redirected to the first module they are assigned. The milk screen moves wholesale to `app/(app)/milk/page.tsx` alongside `/land` and `/shop`, so all three modules are routed the same way and `lib/modules.ts` stops carrying a special case for MILK. New read helpers are thin wrappers over the aggregates that already exist in `lib/db/*`, keeping the owner-only financial split intact.

**Tech Stack:** Next.js 16.3.5 (App Router, server components), React 19.2.8, Prisma 7.10 (Postgres), Clerk 7.9, Tailwind CSS 4, shadcn/ui, lucide-react.

## Global Constraints

- **No test framework exists in this repo.** There are no test files and no runner in `devDependencies`. `ai-workflow-rules.md` forbids inventing behaviour not defined in the context files, so this plan does **not** introduce one. Every task verifies with `npx tsc --noEmit`, `npm run lint`, `npm run build`, and an explicit browser check. Do not add vitest/jest as part of this unit.
- Do not modify `components/ui/*` (spec; `ai-workflow-rules.md` protected files).
- Do not modify `prisma/schema.prisma` (protected file). This unit needs no schema change.
- Default to server components; `"use client"` only where browser interactivity requires it (`code-standards.md`).
- All Prisma access stays in server components / actions. No Prisma in client code.
- Use CSS custom property tokens from `ui-context.md`. No hardcoded hex values. Light-only theme — no dark-mode variants.
- Money is owner-only (`architecture.md` invariant 2). Privileged helpers are named `...WithFinancials()` / `...WithPricing()` and may only be called after `role === OWNER` is verified.
- Money crosses the server/client boundary as **integer cents**, never `Prisma.Decimal` (`lib/db/money.ts`).
- Money is formatted without a currency symbol (`formatCents`, open question 20).
- Do not build `InputRecord` / cost-vs-yield (Next Up #3). Do not build the worker-module-assignment control (open question 19).
- Read the relevant guide in `node_modules/next/dist/docs/` before writing framework code (`AGENTS.md`). `redirect()` reference: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`.
- Commit after each task.

---

## Deviations from the spec, found during research

These are places where the spec's letter and the codebase disagree. Each has a decision recorded; raise with the author if you disagree before implementing.

1. **`getLowStockAlerts()` already exists under another name.** `lib/db/shop.ts` already exports `getLowStockItems()` — `lowStockThreshold: { not: null }`, `quantity <= lowStockThreshold`, `stockItemSafeSelect` (no `unitPrice`), ordered by quantity ascending. That is exactly what the spec describes. **Decision: reuse `getLowStockItems()`; do not add a second helper.** Adding `getLowStockAlerts()` would duplicate a working query, which the spec's own "do not duplicate" instruction argues against.

2. **`lib/modules.ts` must change, and the spec does not mention it.** `MODULES` currently pins MILK to `href: "/"` with a comment saying so. Extracting the milk screen makes that wrong — the registry is the single place a module's route is written down, so it has to move to `/milk` in the same unit.

3. **`Sale.date` is a timestamp, not a civil day.** `MilkRecord.date` and `HarvestRecord.date` are `@db.Date` (Prisma reads them back as midnight UTC, which is what `farmDate()` produces). `Sale.date` is a plain `DateTime @default(now())`. So "today's sales" cannot use `date: today` — it needs a half-open instant range over the server's civil day. `lib/db/dates.ts` covers `@db.Date` only and has no such helper, so Task 2 adds `civilDayRange()`. Getting this wrong reproduces the silent date shift fixed in `2cfa1a3`.

4. **Harvest quantities carry units and cannot be summed into one number.** `HarvestRecord.unit` is one of `HARVEST_UNITS` (`kg`, `bags`, `crates`, `bunches`). `getRecentHarvestSummary()` therefore groups by unit, exactly as the existing `sumHarvestQuantity()` does, and the Land card renders the largest-unit total as its headline with the entry count beneath. Inventing a single blended figure would be a fabricated product fact.

---

## File Structure

**Create:**
- `app/(app)/milk/page.tsx` — the Cows & Milk screen, moved out of `app/(app)/page.tsx`. Owns both role variants (`OwnerMilkHome`, `WorkerMilkEntry`) and the milk-only formatting helpers.
- `components/farm/metric-card.tsx` — one module's headline figure, accented per module. Presentational, server-safe, reused by all three cards.
- `components/farm/needs-attention-list.tsx` — the cross-module alert list. Presentational; takes already-shaped rows so it never reads the database itself.

**Modify:**
- `app/(app)/page.tsx` — reduced to a role branch: owner renders the dashboard, worker redirects. Keeps the "Worker access" section below the dashboard.
- `lib/modules.ts` — MILK `href` `/` → `/milk`; add `landingHrefFor()`.
- `lib/db/dates.ts` — add `civilDayRange()`.
- `lib/db/milk.ts` — add `getTodayMilkTotal()`.
- `lib/db/land.ts` — add `getRecentHarvestSummary()`.
- `lib/db/shop.ts` — add `getTodaySalesSummary()` and `getTodaySalesSummaryWithFinancials()`.
- `app/globals.css` — remove the `--sidebar-*` definitions and their `--color-sidebar-*` mappings.
- `context/ui-context.md`, `context/architecture.md`, `context/progress-tracker.md` — doc sync (`ai-workflow-rules.md`).

**Unchanged on purpose:** `components/farm/module-nav.tsx` (spec 07 already landed), `milk-entry-form.tsx`, `milk-history-list.tsx`, `worker-pin-list.tsx` — these change import sites, not contents.

---

### Task 1: Module registry routes milk at `/milk`

**Files:**
- Modify: `lib/modules.ts:22-29` (the `MODULES` array and its comment), and append `landingHrefFor()`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `landingHrefFor(assignedModules: readonly Module[]): string | null` — the route a user should land on, or `null` when they are assigned nothing reachable. Task 6 depends on this exact name and signature.

- [ ] **Step 1: Point MILK at its own route**

Replace the MILK entry and the comment above it in `lib/modules.ts`:

```ts
export const MODULES: readonly ModuleDefinition[] = [
  // Each module owns a route of its own. Milk used to sit at `/` because home
  // *was* the milk screen; `/` is now a role branch (the owner's dashboard, or
  // a worker's redirect), so the special case is gone and the registry reads
  // the same for all three.
  { value: "MILK", label: "Cows & Milk", href: "/milk", accent: "moss" },
  { value: "LAND", label: "Land & Produce", href: "/land", accent: "gold" },
  { value: "SHOP", label: "Shop", href: "/shop", accent: "ochre" },
]
```

- [ ] **Step 2: Add the landing-route helper**

Append to `lib/modules.ts`:

```ts
/**
 * Where a user should land when they open the app.
 *
 * The first module they are assigned, in registry order (MILK, LAND, SHOP) —
 * not the order the assignment happens to be stored in, so two workers with
 * the same modules always land the same way.
 *
 * `null` when there is nowhere to send them: a module with no route yet, or an
 * assignment naming nothing reachable. The caller shows an explanation rather
 * than redirecting into a 404.
 */
export function landingHrefFor(
  assignedModules: readonly Module[]
): string | null {
  return (
    modulesFor(assignedModules).find((module) => module.href !== null)?.href ??
    null
  )
}
```

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean. The app still has no `/milk` route until Task 6 — `tsc` does not check route strings, so this passes. Do not run the browser yet.

- [ ] **Step 4: Commit**

```bash
git add lib/modules.ts
git commit -m "Give Cows & Milk a route of its own in the registry"
```

---

### Task 2: Civil-day range helper, and the milk and land reads

**Files:**
- Modify: `lib/db/dates.ts` (append `civilDayRange()`)
- Modify: `lib/db/milk.ts` (append `getTodayMilkTotal()` after `sumMilkLiters`)
- Modify: `lib/db/land.ts` (append `getRecentHarvestSummary()` after `sumHarvestQuantity`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `civilDayRange(at?: Date): { start: Date; end: Date }`
  - `getTodayMilkTotal(today: Date): Promise<{ liters: number; entries: number }>`
  - `getRecentHarvestSummary(options?: { from?: Date }): Promise<{ totals: { unit: string; quantity: number }[]; entries: number }>`
  - Tasks 3 and 6 depend on these exact names and shapes.

- [ ] **Step 1: Add `civilDayRange()` to `lib/db/dates.ts`**

Append:

```ts
/**
 * The instants bounding the server's civil day `at` falls on, half-open:
 * `start <= t < end`.
 *
 * For **timestamp** columns, not `@db.Date` ones. `Sale.date` is a plain
 * `DateTime @default(now())`, so "today's sales" cannot compare against the
 * midnight-UTC value `farmDate()` returns — on any server west of Greenwich
 * that silently selects the wrong day. These are real local-midnight instants,
 * built with the local constructor for the same reason `farmDate()` uses the
 * local getters: the civil day is the server's, not UTC's.
 *
 * Half-open rather than inclusive at both ends, because the upper bound is an
 * instant: `lte` midnight tomorrow would count a sale rung up at exactly
 * 00:00:00.000 on both days.
 */
export function civilDayRange(at: Date = new Date()): {
  start: Date
  end: Date
} {
  return {
    start: new Date(at.getFullYear(), at.getMonth(), at.getDate()),
    end: new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1),
  }
}
```

- [ ] **Step 2: Add `getTodayMilkTotal()` to `lib/db/milk.ts`**

Add to the existing import block at the top of the file:

```ts
import { roundLiters } from "../milk-config"
```

Append after `sumMilkLiters`:

```ts
/**
 * Today's herd total and how many entries make it up — a plain quantity, no
 * financial concern, so there is one path and no owner-only twin.
 *
 * `today` is passed in rather than read here: `MilkRecord.date` is `@db.Date`,
 * and the caller already holds the `farmDate()` value the rest of its page is
 * rendered against. Two independent `farmDate()` calls either side of midnight
 * would disagree.
 *
 * A day with no milking sums to 0, not null — "nothing logged" is zero liters,
 * and a nullable number invites a `?? 0` one caller will forget. Rounded
 * through `roundLiters` so a sum of half-liter readings shows 47.5 rather than
 * 47.499999999999996.
 */
export async function getTodayMilkTotal(
  today: Date
): Promise<{ liters: number; entries: number }> {
  const [{ _sum }, entries] = await Promise.all([
    prisma.milkRecord.aggregate({
      where: { date: today },
      _sum: { liters: true },
    }),
    prisma.milkRecord.count({ where: { date: today } }),
  ])

  return { liters: roundLiters(_sum.liters ?? 0), entries }
}
```

- [ ] **Step 3: Add `getRecentHarvestSummary()` to `lib/db/land.ts`**

Add to the existing import block at the top of the file:

```ts
import { roundQuantity } from "../land-config"
```

Append after `sumHarvestQuantity`:

```ts
/**
 * Recent harvest activity, grouped by the unit each record was logged in.
 *
 * Grouped rather than summed because `HarvestRecord.unit` is one of
 * `HARVEST_UNITS` — kg, bags, crates, bunches — and adding 12 crates to 40 kg
 * produces a number that means nothing. `sumHarvestQuantity()` groups for the
 * same reason. Largest total first, so a caller showing one headline figure
 * shows the unit that dominated the period.
 *
 * Quantity only. `InputRecord`, cost and cost-vs-yield are a later unit, so
 * there is no financial twin of this helper to forget to gate.
 */
export async function getRecentHarvestSummary(
  options: { from?: Date } = {}
): Promise<{
  totals: { unit: string; quantity: number }[]
  entries: number
}> {
  const where = options.from ? { date: { gte: options.from } } : undefined

  const [grouped, entries] = await Promise.all([
    prisma.harvestRecord.groupBy({
      by: ["unit"],
      where,
      _sum: { quantity: true },
    }),
    prisma.harvestRecord.count({ where }),
  ])

  return {
    totals: grouped
      .map((row) => ({
        unit: row.unit,
        quantity: roundQuantity(row._sum.quantity ?? 0),
      }))
      .sort((a, b) => b.quantity - a.quantity),
    entries,
  }
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add lib/db/dates.ts lib/db/milk.ts lib/db/land.ts
git commit -m "Add the dashboard's milk and harvest reads, and a civil-day range"
```

---

### Task 3: Shop reads, safe and privileged

**Files:**
- Modify: `lib/db/shop.ts` (append to the "Sale-screen reads" section, before the "Writes" banner)

**Interfaces:**
- Consumes: `civilDayRange` from Task 2.
- Produces:
  - `getTodaySalesSummary(at?: Date): Promise<{ sales: number }>`
  - `getTodaySalesSummaryWithFinancials(at?: Date): Promise<{ sales: number; revenueCents: number }>`
  - Task 6 depends on these exact names and shapes. Low-stock rows come from the **existing** `getLowStockItems()` — see Deviation 1; do not add `getLowStockAlerts()`.

- [ ] **Step 1: Add both helpers to `lib/db/shop.ts`**

Add to the existing import block at the top:

```ts
import { civilDayRange } from "./dates"
```

Append immediately before the `// ───────────── Writes ─────────────` banner:

```ts
/**
 * How many sales were rung up today — a count, no money. The safe path
 * (invariant 2); `getTodaySalesSummaryWithFinancials()` is the owner's twin.
 *
 * `Sale.date` is a timestamp, not a `@db.Date` column, so this compares
 * against a half-open instant range rather than a civil-day value. See
 * `civilDayRange()`.
 */
export async function getTodaySalesSummary(
  at: Date = new Date()
): Promise<{ sales: number }> {
  const { start, end } = civilDayRange(at)

  return {
    sales: await prisma.sale.count({ where: { date: { gte: start, lt: end } } }),
  }
}

/**
 * Owner-only: the same count plus today's takings in whole cents. Verify
 * `role === OWNER` before calling.
 *
 * A day with no sales is 0 revenue, not null, matching
 * `sumSalesRevenueWithFinancials()`.
 */
export async function getTodaySalesSummaryWithFinancials(
  at: Date = new Date()
): Promise<{ sales: number; revenueCents: number }> {
  const { start, end } = civilDayRange(at)
  const where = { date: { gte: start, lt: end } }

  const [sales, { _sum }] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.aggregate({ where, _sum: { totalAmount: true } }),
  ])

  return {
    sales,
    revenueCents: _sum.totalAmount ? toCents(_sum.totalAmount) : 0,
  }
}
```

- [ ] **Step 2: Verify, and check the Decimal never escapes**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. Then confirm by eye that `getTodaySalesSummaryWithFinancials` returns `revenueCents: number` and that no `totalAmount` survives into the returned shape. This is the spec's "no `Decimal` in the rendered payload" check, enforced at the source rather than at the page.

**`getTodaySalesSummary()` has no caller, and that is deliberate** — the spec asks for it as "what any non-owner code path would get, even though nothing non-owner reads this page". It is the safe twin that keeps the pair symmetrical with every other financial helper in this file. Do not delete it as dead code.

- [ ] **Step 3: Commit**

```bash
git add lib/db/shop.ts
git commit -m "Add today's shop summary, count-only and owner-only"
```

---

### Task 4: The metric card

**Files:**
- Create: `components/farm/metric-card.tsx`

**Interfaces:**
- Consumes: `moduleDefinition` from `lib/modules.ts`.
- Produces: `<MetricCard module={Module} value={string} detail={string} />`. Task 6 renders three of these.

- [ ] **Step 1: Write the component**

```tsx
import Link from "next/link"
import { MilkIcon, SproutIcon, StoreIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Module } from "@prisma/client"

import { moduleDefinition } from "@/lib/modules"
import { cn } from "@/lib/utils"

// One module's headline figure on the owner's dashboard.
//
// Presentational only: it takes an already-formatted `value` rather than a
// number and a unit, because the three modules count different things — liters,
// a unit-bearing harvest quantity, a money figure — and a card that formatted
// all three would end up knowing about all three.
//
// The whole card is the link. `ui-context.md` gives the grid equal weight per
// module, so no card is styled as the primary one.

const ICONS: Record<Module, LucideIcon> = {
  MILK: MilkIcon,
  LAND: SproutIcon,
  SHOP: StoreIcon,
}

const ACCENT_TEXT = {
  moss: "text-moss",
  gold: "text-gold",
  ochre: "text-ochre",
} as const

type MetricCardProps = {
  module: Module
  /** The figure itself, already formatted — "47.5 L", "120 kg", "18,400". */
  value: string
  /** What the figure counts, beneath it — "4 entries today". */
  detail: string
}

/**
 * A module's card: its name, one figure, and one line of context.
 *
 * The module's label and route come from the registry rather than from props,
 * so a card can never disagree with the nav about where a module lives.
 */
export function MetricCard({ module, value, detail }: MetricCardProps) {
  const definition = moduleDefinition(module)
  const Icon = ICONS[module]

  return (
    <Link
      href={definition.href ?? "#"}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-foreground/30"
    >
      <span className="flex items-center gap-2">
        <Icon
          className={cn("h-5 w-5", ACCENT_TEXT[definition.accent])}
          aria-hidden
        />
        <span className="text-sm font-medium text-muted-foreground">
          {definition.label}
        </span>
      </span>

      <span className="text-3xl font-semibold tabular-nums">{value}</span>
      <span className="text-sm text-muted-foreground">{detail}</span>
    </Link>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/farm/metric-card.tsx
git commit -m "Add the dashboard's per-module metric card"
```

---

### Task 5: The needs-attention list

**Files:**
- Create: `components/farm/needs-attention-list.tsx`

**Interfaces:**
- Consumes: `moduleDefinition` from `lib/modules.ts`.
- Produces: `<NeedsAttentionList items={readonly NeedsAttentionItem[]} />` and `export type NeedsAttentionItem = { id: string; module: Module; title: string; detail: string }`. Task 6 builds the array.

- [ ] **Step 1: Write the component**

```tsx
import Link from "next/link"
import type { Module } from "@prisma/client"

import { moduleDefinition } from "@/lib/modules"
import { cn } from "@/lib/utils"

// The one cross-module list on the owner's dashboard: what wants doing,
// wherever it lives.
//
// Deliberately thin on sources. Low stock is the only alert with a real data
// source today — a shop item at or under its own threshold. Milk and land
// alerts arrive with the health-reminder and cost-vs-yield units; inventing
// them now would put a fabricated product fact on the owner's home screen,
// which `ai-workflow-rules.md` forbids.
//
// Takes already-shaped rows rather than reading the database itself, so the
// page owns every query and this file stays renderable from anywhere.

const ACCENT_BORDER = {
  moss: "border-l-moss",
  gold: "border-l-gold",
  ochre: "border-l-ochre",
} as const

export type NeedsAttentionItem = {
  id: string
  module: Module
  /** What it is — a stock item's name. */
  title: string
  /** Why it is here — "3 kg left, alerts under 10". */
  detail: string
}

/**
 * What needs the owner's attention, across all three modules.
 *
 * Renders an explicit "nothing needs attention" rather than an empty panel: a
 * blank space reads as a screen that failed to load, not as good news.
 */
export function NeedsAttentionList({
  items,
}: {
  items: readonly NeedsAttentionItem[]
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Nothing needs attention right now.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const definition = moduleDefinition(item.module)

        return (
          <li key={item.id}>
            <Link
              href={definition.href ?? "#"}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border border-l-4 border-border bg-card p-4 shadow-sm transition-colors hover:border-foreground/30",
                ACCENT_BORDER[definition.accent]
              )}
            >
              <span className="flex flex-col gap-1">
                <span className="font-semibold">{item.title}</span>
                <span className="text-sm text-muted-foreground">
                  {item.detail}
                </span>
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {definition.label}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

**Watch the left border in the browser once Task 6 renders this.** The class list sets `border-border` (all four sides) and then `border-l-moss`/`gold`/`ochre` for the left edge only. Those have equal CSS specificity, so which one wins depends on the order Tailwind emits them, not on the order in the `className` string. If the accent edge comes out the default border colour, swap `ACCENT_BORDER` to an arbitrary property — `border-l-[var(--accent-moss)]` — which raises specificity and settles it. Do not reach for `!important`.

- [ ] **Step 3: Commit**

```bash
git add components/farm/needs-attention-list.tsx
git commit -m "Add the dashboard's cross-module needs-attention list"
```

---

### Task 6: Move milk to `/milk`, make `/` the dashboard and the worker's router

One task, not two: `/` and `/milk` have to change together or the app is broken between them. A reviewer cannot sensibly approve half of it.

**Files:**
- Create: `app/(app)/milk/page.tsx`
- Modify: `app/(app)/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `landingHrefFor` (Task 1); `getTodayMilkTotal`, `getRecentHarvestSummary` (Task 2); `getTodaySalesSummaryWithFinancials` (Task 3); `MetricCard` (Task 4); `NeedsAttentionList`, `NeedsAttentionItem` (Task 5); and the existing `getLowStockItems()` from `lib/db/shop.ts`.
- Produces: the finished routes.

- [ ] **Step 1: Move the milk screen into its own route**

Create `app/(app)/milk/page.tsx` holding everything currently in `app/(app)/page.tsx` — the imports, `dayFormat`, `shortDayFormat`, `sessionForNow`, `toHistoryEntry`, the `requireModule(gate, "MILK")` guard, `WorkerMilkEntry` and `OwnerMilkHome` — with these changes only:

- Rename the default export from `Home` to `MilkPage`.
- **Remove** the "Worker access" `<section>` from `OwnerMilkHome` (it moves to the dashboard in Step 2), and drop the now-unused `WorkerPinList` import.
- Replace the file's top comment with:

```tsx
// `/milk` — Cows & Milk, for both roles. One route per module, the same as
// `/land` and `/shop`; this screen used to be `/` itself, which is why the
// owner's PIN controls lived on it. They belong to the dashboard now.
//
// The worker gets the entry screen and their own entries; the owner gets the
// same form plus everyone's history.
```

Move the code; do not duplicate it. `MilkEntryForm`, `MilkHistoryList` and `ModuleNav` keep their current import paths.

- [ ] **Step 2: Rewrite `app/(app)/page.tsx`**

Replace the file entirely:

```tsx
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
              milk.entries === 1 ? "1 entry today" : `${milk.entries} entries today`
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
            detail={shop.sales === 1 ? "1 sale today" : `${shop.sales} sales today`}
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
```

- [ ] **Step 3: Verify types, lint and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all clean, and the build's route list now includes `/milk` alongside `/`, `/land` and `/shop`.

- [ ] **Step 4: Walk it in a browser — this is the real check**

Run `npm run dev`, then confirm each of these by eye. `npm run build` cannot catch any of them:

1. Sign in as the owner. `/` shows the dashboard: three cards, the needs-attention section, and Worker access below it.
2. Narrow the window to a phone width (≤ 640px). The three cards stack into one column. Widen past `md` (768px). They sit three across. **Check both, not just one.**
3. Click each card — they land on `/milk`, `/land` and `/shop` respectively.
4. Visit `/milk` as the owner. It is what `/` used to show, minus the Worker access section.
5. Set a worker's `assignedModules` to `["LAND"]` and sign in as them. They land on `/land`, not on milk.
6. Set it to `["SHOP"]`. They land on `/shop`.
7. Set it to `[]` (empty means all). They land on `/milk`, registry order.
8. The Land card shows a quantity with a unit and no money anywhere; the Shop card's figure comes from `formatCents` and carries no currency symbol.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/page.tsx" "app/(app)/milk/page.tsx"
git commit -m "Give milk its own route, and make home the owner's dashboard"
```

---

### Task 7: Drop the unused sidebar tokens

**Files:**
- Modify: `app/globals.css:37-44` (the `--color-sidebar-*` mappings) and `app/globals.css:144-151` (the `--sidebar-*` definitions)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. Purely subtractive.

- [ ] **Step 1: Confirm nothing references them**

Run: `grep -rin "sidebar" --include="*.tsx" --include="*.ts" --include="*.css" . | grep -v node_modules`
Expected: matches in `app/globals.css` only (plus the context markdown, which is not code). If any component matches, stop — the spec's instruction to drop them assumed nothing uses them.

- [ ] **Step 2: Delete both blocks**

Remove these eight lines from the `@theme` block:

```css
    --color-sidebar-ring: var(--sidebar-ring);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar: var(--sidebar);
```

And these eight from the `:root` block:

```css
    --sidebar: var(--bg-surface);
    --sidebar-foreground: var(--text-primary);
    --sidebar-primary: var(--text-primary);
    --sidebar-primary-foreground: var(--bg-surface);
    --sidebar-accent: var(--border-default);
    --sidebar-accent-foreground: var(--text-primary);
    --sidebar-border: var(--border-default);
    --sidebar-ring: var(--text-muted);
```

- [ ] **Step 3: Verify**

Run: `npm run build && npm run lint`
Expected: clean. Reload the dashboard in the browser and confirm nothing lost its styling.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "Drop the sidebar tokens nothing was using"
```

---

### Task 8: Sync the context docs

`ai-workflow-rules.md` requires this, and open question 18 was settled as a precondition of this unit — it has to be recorded, not just acted on.

**Files:**
- Modify: `context/ui-context.md`
- Modify: `context/architecture.md`
- Modify: `context/progress-tracker.md`

**Interfaces:**
- Consumes: the decisions made in Tasks 1-7.
- Produces: nothing code depends on.

- [ ] **Step 1: Record the viewport decision in `ui-context.md`**

Update the **Owner dashboard** bullet under "Layout Patterns" to name the width, then add a `## Viewport` section after the layout patterns:

```markdown
## Viewport

The app is a PWA on both phone and computer (`architecture.md`), but the two
do not get the same layout, and the split is per screen rather than app-wide.

| Screen | Container | Why |
| --- | --- | --- |
| Worker task screens | `max-w-xl`, centred | One task at a time, large controls. Width buys nothing. |
| Owner module screens | `max-w-2xl`, centred | A form and a history list; a second column would be padding. |
| Owner dashboard | `max-w-5xl`, centred | The only screen with a 3-across grid. Three cards in a phone column are just a list. |

The dashboard grid is `grid-cols-1` below `md` and `grid-cols-3` from `md` up.

**No sidebar.** A persistent module sidebar would duplicate
`components/farm/module-nav.tsx`, which already has its own deliberate
treatment. The `--sidebar-*` tokens shadcn generated were removed from
`app/globals.css` rather than left parked.
```

- [ ] **Step 2: Record the routing change in `architecture.md`**

At the `app/` description near line 19, and wherever routes are listed: `/` is a role branch (the owner's dashboard, or a worker's redirect to the first assigned module), and Cows & Milk now lives at `/milk` beside `/land` and `/shop`.

- [ ] **Step 3: Update `progress-tracker.md`**

Four edits:

- Move the three-module owner dashboard out of "Next Up" (item 2) into the completed work, recording what it does and does not read — no `InputRecord`, no milk or land alerts.
- Close **open question 18** with the per-screen answer from Step 1, noting it was settled before the dashboard was built, as the question itself asked.
- Note against **open question 4** that the `--sidebar-*` tokens are gone, so that part of it is resolved; anything else the question covers stays open.
- Add a decision entry: the owner's home is now the dashboard rather than one module, and why that changed — all three modules have a write path, and `/`'s hardcoded milk landing was ignoring `assignedModules`. This supersedes the existing "The owner's home is one module, not the dashboard" note; edit that note rather than leaving two entries that contradict each other.

- [ ] **Step 4: Verify the claims are true**

Re-read each edit against the code as it now stands. A progress tracker that describes work that was not done is worse than one that says nothing.

- [ ] **Step 5: Commit**

```bash
git add context/ui-context.md context/architecture.md context/progress-tracker.md
git commit -m "Record the dashboard, the routing change and the viewport answer"
```

---

## Final verification

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] Every browser check in Task 6 Step 4 was walked, not assumed
- [ ] `git status` is clean apart from the `AGENTS.md` block `next dev` rewrites (commit it with the work, per `AGENTS.md`)
