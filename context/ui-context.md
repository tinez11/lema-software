# UI Context

## Theme

Light-only — no dark mode. The design language blends clean/minimal
structure with a warm, earthy mood: a warm stone-white background
rather than stark white, deep olive-charcoal text rather than pure
black, and three subject-grounded accent colors (one per module)
rather than a single generic brand color.

## Colors

| Role                         | CSS Variable        | Value     |
| ----------------------------- | -------------------- | --------- |
| Page background               | `--bg-base`          | `#EFF0E6` |
| Surface / card                | `--bg-surface`       | `#FBFAF3` |
| Primary text                  | `--text-primary`     | `#262919` |
| Muted text                    | `--text-muted`       | `#6B6C5E` |
| Border                        | `--border-default`   | `#DEDBC9` |
| Accent — Cows & Milk (moss)   | `--accent-moss`      | `#2E7D32` |
| Accent — Land & Produce (gold)| `--accent-gold`      | `#96692A` |
| Accent — Shop (ochre)         | `--accent-ochre`     | `#8C6A22` |
| Attention / alert (rust)      | `--accent-rust`      | `#9B4A34` |

Each module keeps its accent color consistently across the dashboard,
its own module screens, and the cross-module "needs attention" list,
so the color itself signals which module something belongs to.

## Typography

| Role      | Font                       | Variable      |
| --------- | --------------------------- | -------------- |
| UI text   | Manrope                     | `--font-sans`  |
| Code/mono | System monospace stack      | `--font-mono`  |

Manrope is self-hosted through `next/font/google` in `app/layout.tsx`,
which exposes it as `--font-manrope`; `--font-sans` points at that with
a system fallback stack. Headings use the same family via
`--font-heading`.

## Border Radius

| Context                | Value                   | Tailwind class |
| ---------------------- | ----------------------- | -------------- |
| Small UI controls      | `12px` (`--radius`)     | `rounded-lg`   |
| Cards / panels         | `16–20px`               | `rounded-xl` (16px), `rounded-2xl` (20px) |
| Pills / badges / tags  | `20px+` (fully rounded) | `rounded-4xl`  |
| Primary action buttons | `16px`                  | `rounded-xl`   |

The scale is pinned to these values in the `@theme inline` block of
`app/globals.css`, so the shadcn primitives land on the right radius
without being edited.

## Component Library

Tailwind CSS v4 + shadcn/ui (Radix base, `radix-nova` style).
Components live in `components/ui/`; add new primitives via the shadcn
CLI rather than writing them from scratch, and never hand-edit what the
CLI generates.

The theme reaches those primitives by **token remapping, not by editing
them**: `app/globals.css` redefines shadcn's semantic variables
(`--background`, `--card`, `--primary`, `--muted`, `--destructive`, …)
in terms of the palette above. Notes on that mapping:

- `--primary` is the deep olive-charcoal `--text-primary`, not a brand
  colour — the three module accents are what carry meaning.
- `--secondary`, `--muted` and `--accent` all resolve to
  `--border-default`, the one subtle warm fill; it reads against both
  the page base and card surfaces.
- `--destructive` is `--accent-rust`.
- Module accents are exposed as utilities — `bg-moss`, `text-gold`,
  `border-ochre`, `ring-rust`, and their `-foreground` pairs.

This version of the shadcn registry ships `field` (`components/ui/field.tsx`)
in place of the older `form` component; use `Field` for form composition.

## Dark Mode

There is none. `app/globals.css` keeps the `dark` custom variant scoped
to a `.dark` ancestor that the app never renders — removing the variant
would make Tailwind fall back to `prefers-color-scheme`, which is
exactly what `code-standards.md` forbids. `color-scheme: light` is set
on `:root` so native controls stay light too, and the `Toaster` is
mounted with `theme="light"` because the generated component otherwise
defaults to next-themes' `system`.

## Layout Patterns

- **Owner dashboard**: vertical stack — greeting header, a 3-across
  equal-weight metric card grid (one per module, collapsing to a
  single column on phone widths), and a single "needs attention" list
  below that cuts across all three modules.
- **Module home screens**: header with back navigation, a small tab
  set for sub-areas (e.g. Milk / Animals / Health), one dominant
  primary-action button (e.g. "Log milk"), and a browsable history
  list beneath it.
- **Shop / POS screen**: a tappable item grid for quick-add, a running
  "current sale" summary panel with per-line quantity steppers, and a
  sticky, high-contrast checkout button at the bottom.
- **Worker entry screens**: no dashboard, no tabs, no module
  switching — the app opens directly to the one task the worker is
  assigned. Large stepper controls, one primary action button, and a
  visible "saved locally" sync-status indicator at all times.
- Owner-facing screens may use a softer, layered visual treatment;
  worker-facing screens stay flat and high-contrast, since speed and
  outdoor legibility matter more than mood there.

## Owner vs. Worker Treatment

The difference is concrete, not a mood — same palette, same radii, two
densities:

| | Owner | Worker |
| --- | --- | --- |
| Panel fill | `--bg-surface` | `--bg-surface` |
| Panel edge | 1px `--border-default` + `shadow-sm` | 2px `--border-default`, no shadow |
| Panel padding | `p-6`, `gap-6` between blocks | `p-5`, `gap-8` between blocks |
| Body type | `text-sm` / `text-base` | `text-base` minimum, labels `text-lg` |
| Primary action | inline, sized to content | full width |
| Touch targets | `h-9`–`h-11` | `h-14` minimum |

Worker screens drop shadows entirely: in direct sunlight a soft shadow
reads as smudge, while a 2px border still separates a panel from the
page. Owner screens keep the shadow because layering is what makes a
dense dashboard scannable.

## Primary Action Button

The dominant action on a screen ("Log milk", "Checkout", "Unlock") is
`h-14` (56px), `text-lg`, `font-semibold`, `rounded-xl` (16px). The
shadcn `lg` size (`h-9`) is for secondary actions only — 36px is too
small for a gloved thumb outdoors. On worker screens the primary action
is also full width; on owner screens it sizes to its content.

Sibling controls that must match that height — a PIN field, a quantity
stepper — use `h-14` too, so a worker's row of targets is one size.

## Entry Controls

The two controls a data-entry screen is built from. Both are `h-14`
with a 2px edge on **both** owner and worker screens: the owner/worker
split is panel density and button width, not target size, and a control
that changes size between roles is a second thing to get right for no
gain.

- **Quantity stepper** (`components/farm/quantity-stepper.tsx`) —
  `−` / value / `+`, the two buttons square at `h-14 w-14`, the value a
  centred `text-lg font-semibold tabular-nums` field with its unit set
  inside the trailing edge in muted type. The field is typeable, not
  only tappable: 40 liters is 80 taps otherwise. Unaware of milk, so a
  harvest weight and a stock count reuse it as-is.
- **Choice grid** (`components/farm/choice-grid.tsx`) — one `h-14` cell
  per option in a 2-, 3- or 4-column grid. Selected is a filled cell in
  the module's accent (`accent="moss" | "gold" | "ochre"`), which is
  those colours doing the job they are defined for. Native radios sit
  under the labels, so arrow keys, the checked state and the group name
  come for free. An option can carry a check mark — already logged,
  already used — rather than being disabled: the clash is worth seeing
  before the tap, but the server is what refuses it.
  `session-toggle.tsx` is the Cows & Milk instance of it, adding the two
  sessions and their icons; the harvest unit picker is another.

A choice with a small, fixed set of options gets one cell per option at
full width, never a `Select`: a dropdown on a phone costs two taps and
hides the options until the first one.

A choice whose set **grows with the farm** — a crop cycle picker, later
a stock item — does get a `Select`, at `h-14` with a 2px edge so it
still matches the row it sits in. The line is whether the options are
knowable in advance, not how many there happen to be today.

## Navigation vs. Content

Cross-module navigation is **ruled off and labelled**, never another card
in the same stack.

A nav row and a data row are the same shape — a bordered panel on a
card fill — so stacking them in one column with one gap makes leaving
the screen look like more of the screen. On the milk entry screen that
put "Morning" and "Evening" directly above "Land & Produce" and "Shop"
with nothing to tell them apart.

`components/farm/module-nav.tsx` therefore renders as its own group:

| | Owner | Worker |
| --- | --- | --- |
| Separator | `border-t` (1px) `--border-default` | `border-t-2` (2px) |
| Space above the rule | `mt-2`, on top of the page's `gap-6` | `mt-4`, on top of the page's `gap-8` |
| Space below the rule | `pt-6` | `pt-8` |
| Heading | "Other modules", `text-sm` muted | same, `text-base` muted |

The heading is deliberately **quieter** than the section heading above
it ("Logged today" is `text-lg font-semibold`): it labels a way out of
the screen, not another section of its data. The rule weight follows the
same logic as panel edges — 2px for a worker, 1px plus shadow for the
owner.

The separation lives in the component, so every screen that renders it
inherits it and no page overrides it. Individual rows — icon, label,
chevron — are unchanged by the grouping.

## Module Accents in Practice

Each module's accent marks its own screens, and the same three roles
recur: the header eyebrow beside the module icon, the selected cell of a
choice grid, and the quantity on a history row. Cows & Milk is moss,
Land & Produce gold, Shop ochre. Rust stays reserved for attention and
destructive actions and is never a module's colour.

## Icons

Lucide React . Outline-style icons only. `h-4 w-4` (16px) for inline
use, `h-5 w-5` (20px) for buttons.
