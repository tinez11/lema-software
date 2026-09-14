Read `Agents.md` before starting

Were fixing a visual hierarchy bug: cross-module navigation reads as
though it belongs to the current module's content.

Per the screenshot on the milk entry screen: "Logged today" (Morning,
Evening) and the `module-nav.tsx` links (Land & Produce, Shop) are
visually identical rows stacked in one column, with nothing between
them. A worker scanning the screen has no visual cue that the first
two rows are data and the last two are somewhere else entirely.

This is `module-nav.tsx` itself, not a one-off on the milk screen — fix
it once there and every screen that renders it (home, and eventually
land and shop) inherits the correction.

Give the nav its own labeled section, the same pattern `ui-context.md`
already uses for "Logged today" — a small muted heading above the
group — but visually separated from whatever content sits above it:
extra top margin plus a `border-t` using `--border-default`, not just
another card in the same stack. Something like "Other modules" or
"Switch module" as the heading text — pick one, but it must read as
navigation, not as a peer to the data above it.

Do not change how each individual nav row looks (icon, label, chevron)
— only its grouping and separation from what precedes it. Do not touch
the "Logged today" list or its styling.

Follow the existing worker/owner treatment split in `ui-context.md` —
this needs to work on both, since `module-nav.tsx` renders on both the
worker's and the owner's home screen.

Do not modify `components/ui/*`.

### Check when done
- On the milk screen from the screenshot, there is a visible break
  (spacing + rule) between "Logged today" and the module nav — not
  just sequential cards with no distinction
- The nav carries a heading identifying it as navigation
- The fix lives in `module-nav.tsx` alone; no per-page overrides
- Renders correctly on both a worker's and the owner's home screen
- `npm run build` passes
- `npm run lint` passes