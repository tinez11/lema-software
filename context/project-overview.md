# Farm & Shop Manager

Lema Software

## Overview

A tailored, home-scale management app for a small operation with three
independent business lines: dairy cattle (herd + milk production), crop
land (fields and harvests), and a standalone retail shop. It's used by
the owner and a small number of farm workers, across both phone and
computer, and must keep working reliably with no internet connection —
syncing automatically once a device reconnects.

## Goals

1. Give the owner accurate, consolidated visibility into milk
   production, land/crop performance, and shop sales — without paper
   records or three separate systems.
2. Let workers log data quickly and reliably in the field, barn, or
   shop, even with no signal, without risking lost or duplicated
   entries.
3. Keep the three business lines fully independent from each other
   operationally, while unifying them under one owner-facing view.

## Core User Flow

1. A user opens the app on their phone or computer. The owner signs in
   with full credentials (via Clerk); a worker unlocks the app with a
   short PIN on a device that's already been provisioned online at
   least once.
2. The owner lands on a cross-module dashboard. A worker lands
   directly on the entry screen for their assigned module — no
   dashboard, no module switching.
3. From the dashboard, the owner taps a module card to open that
   module's home screen (a primary "add entry" action plus a
   browsable history), or taps a "needs attention" item to jump
   straight to that specific record.
4. A worker logs today's data — milk liters, a harvest quantity, or a
   shop sale — which saves to the device immediately and syncs to the
   server automatically once online.
5. The owner reviews consolidated reports (production, cost, sales)
   across all three modules from the dashboard.

## Features

##  Auth
-Owner signs in with full credentials via Clerk; session persists offline once established on a device

-Workers unlock the app with a short PIN on a device that has already authenticated with Clerk at least once  online — the PIN switches between cached identities rather than replacing real authentication

-Every record is attributed to the user who created it; workers can edit only their own recent entries
Revoking a worker's access takes effect once that worker's device next reconnects online


### Cows & Milk

- Animal registry (tag number, breed, date of birth, status) — kept
  for health and breeding tracking even though milk itself isn't
  logged per animal
- Daily herd-total milk entry (morning/evening sessions)
- Health records (vaccinations, illness, treatment) with dashboard
  reminders
- Breeding and calving records

### Land & Produce

- Field/plot registry
- Crop cycle tracking from planting through harvest
- Input cost logging (seed, fertilizer, pesticide, labor)
- Harvest records, with cost-vs-yield reporting visible to the owner
  only

### Shop

- Independent retail stock and a POS-style sale screen
- Cash-only transactions
- Low-stock alerts
- Sales reporting — owner sees revenue, workers see units sold only

### Cross-cutting

- Role-based access: owner (full visibility, all costs and profit)
  vs. worker (quantities only, can edit only their own recent entries)
- Offline-first data entry with automatic background sync
- Reminders and alerts surface on an in-app dashboard only (no SMS or
  push notifications)

## Scope

### In Scope

- Everything listed under Features above
- A PWA usable on both phone and computer
- Offline-capable data entry with sync on reconnect

### Out of Scope

- Per-cow milk tracking (herd totals only)
- Feed formulation or nutrition optimization calculators
- Breeding genetics/pedigree tracking beyond basic calving dates
- IoT/sensor integration (automated milking, soil/weather sensors) or
  AI-based yield forecasting
- Any automatic data link between farm output (milk, harvests) and
  shop stock — the shop is independent retail
- Customer credit accounts (shop is cash-only)
- E-commerce/online sales channel, customer loyalty or marketing
  features, multi-location or multi-till support
- Payroll, full accounting/bookkeeping, tax filing, or invoicing
  beyond simple sale receipts
- Multi-currency support, government/subsidy compliance reporting
- Native app-store distribution as a requirement
- Multi-language/localization support
- Notifications beyond the in-app dashboard

## Success Criteria

1. The owner can view consolidated production, harvest, and sales
   data across all three modules from a single dashboard.
2. A worker can log an entry with no internet connection, and it
   appears on the owner's dashboard once the device reconnects.
3. Workers only ever receive quantities — never cost, price, or
   profit data — enforced at the API/data layer, not just hidden in
   the UI.
4. Two devices cannot create conflicting duplicate herd-milk records
   for the same date and session (enforced by a database constraint).
5. The shop's stock, sales, and POS flow work correctly with zero
   dependency on milk or harvest data.
