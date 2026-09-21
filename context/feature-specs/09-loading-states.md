Read `Agents.md` before starting

Were adding pending/loading states for the three real waiting-moments
in the app: write actions, PIN verification, and the post-sign-in
handoff. This is not a blanket route-loading pass — see the note at
the end for why that's deliberately excluded.

Add `components/farm/submit-button.tsx` wrapping the existing
`components/ui/button.tsx` (do not modify the primitive itself) — it
reads pending state via React's built-in action-pending mechanism,
disables itself, and swaps its label for a spinner (`Loader2` from
`lucide-react`, already installed) while its action is in flight.
Apply it to every write-action button: Save entry, the harvest form,
create field/cycle, create stock item, and checkout.

Update `pin-pad.tsx` to add a third state alongside the existing
offline and lockout states: "checking," shown for the duration of the
`verifyPinHash` round-trip. It must be visually distinct from both —
offline means "can't check right now," checking means "checking right
now," and conflating them would make a slow connection look like no
connection.

Add a lightweight interstitial for the gap between Clerk's redirect
landing and `resolveAuthGate()` resolving — a brief branded loading
state, not a blank flash, shown only for that specific handoff.

Follow the existing worker/owner treatment split: worker buttons keep
their `h-14` full-width shape with the spinner replacing the label
inline; owner buttons follow whatever size they already use on each
screen. No new visual language — this is a state on components that
already exist, not a new component style.

Do not add Next.js route-level `loading.tsx` skeletons anywhere. If a
specific page turns out to be genuinely slow in practice, that is a
future, separately-justified fix for that one page — not a pattern to
apply speculatively across every route now.

Do not modify `components/ui/*`.

### Check when done
- Rapidly double-tapping "Save entry" (or checkout, or any other write
  action) results in exactly one submission, not two — verified by
  attempting it, not just by disabling the button and assuming that's
  sufficient
- The PIN pad shows a distinct "checking" state during
  `verifyPinHash`, visually different from both its offline and
  lockout states
- The post-sign-in gap no longer shows a blank flash between Clerk's
  redirect and the app's own redirect
- No skeleton or spinner was added to a route that doesn't already
  have one of the three real waiting-moments above
- `npm run build` passes
- `npm run lint` passes