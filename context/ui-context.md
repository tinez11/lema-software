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

## Icons

Lucide React . Outline-style icons only. `h-4 w-4` (16px) for inline
use, `h-5 w-5` (20px) for buttons.
