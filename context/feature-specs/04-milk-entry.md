Read `Agents.md` before starting

Were adding the first write path: logging a milk entry, end to end.

Scope is `MilkRecord` only. Animal registry, health records, and
breeding records stay out of this unit entirely — they don't block
milk entry and don't share its write path.

Add to `lib/db/milk.ts`:
- `createMilkRecord(date, session, liters, recordedById)` — do not let
  the unique(date, session) constraint surface as an unhandled `P2002`.
  Catch it and return a typed result (`{ ok: true, record }` or
  `{ ok: false, reason: "duplicate", existing }`) so the UI can say
  "already logged" instead of crashing.
- `updateMilkRecord(id, liters, editingUserId)` — only succeeds if
  `editingUserId` matches the record's own `recordedById` AND the
  record's `date` is today. Anything else returns a typed
  `{ ok: false, reason: "not-yours" | "too-old" }`. This is where
  invariant 2's sibling rule — workers edit only their own recent
  entries — actually gets enforced; it hasn't been built yet anywhere.

Add `app/(app)/milk/actions.ts` — server actions wrapping both
helpers. Validate input with `zod` before calling either. Get the
current user from `resolveAuthGate()`, never from a client-supplied id.

Build `components/farm/quantity-stepper.tsx` and
`components/farm/session-toggle.tsx` — the first two `components/farm/`
pieces. Follow the worker touch-target sizing already resolved in
`ui-context.md` (`h-14`, `text-lg`) since the worker screen is the
primary consumer.

Route on role in `app/(app)/page.tsx`:
- `WORKER` → the milk entry screen directly: session toggle, stepper,
  Save button, and a "logged today" list scoped to that worker's own
  entries. No dashboard, no module switching — matches
  `worker-entry-phone.html`.
- `OWNER` → a single Cows & Milk module home: the same entry form plus
  a recent-history list across all workers. This is not the full
  three-module dashboard — that's a later unit once Land & Produce and
  Shop have a write path too. Don't build it now.

Do not touch `Decimal` serialization or any financial-column question
— `MilkRecord` has none, and this unit must not be read later as having
quietly resolved open question #6 for the modules that do.

Do not modify `components/ui/*`.

### Check when done
- A worker logs a morning entry, then an evening entry, same day — both
  succeed
- A second attempt at an already-logged session returns the typed
  duplicate result and the UI shows a clear message, not a crash
- A worker can edit their own same-day entry; attempting to edit
  another worker's entry, or their own from a prior day, is rejected
  with the typed reason, not a generic error
- The unique(date, session) constraint gets exercised through the real
  UI at least once, not only against the database directly
- Owner's module home shows entries from more than one worker in one
  history list
- `npm run build` passes
- `npm run lint` passes