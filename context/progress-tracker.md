# Progress Tracker

## Current Phase

Phase 0 — Foundation. The design system and UI primitives are in place;
next comes data (Prisma schema + `lib/db/`) and auth.

## Current Goal

Close out Phase 0 and move to Phase 1 — core data entry for a single
module, end to end.

## Completed

- Project scaffolded: Next.js 16.3.5 (App Router, Turbopack) + React 19
  + TypeScript strict + Tailwind CSS v4.
- Context documentation written (`project-overview.md`,
  `architecture.md`, `ui-context.md`, `code-standards.md`,
  `ai-workflow-rules.md`).
- **`01-design-system.md` — design system and UI primitives** ✅
  - shadcn/ui installed and configured (Radix base, `radix-nova`
    style, `components.json` at the project root, `rsc: true`,
    CSS-variable theming).
  - Primitives generated into `components/ui/` (unmodified since
    generation): `alert`, `badge`, `button`, `calendar`, `card`,
    `dialog`, `dropdown-menu`, `field`, `input`, `input-otp`, `label`,
    `popover`, `select`, `separator`, `sheet`, `skeleton`, `sonner`,
    `table`, `tabs`, `textarea`.
  - `lucide-react` installed (it is also the icon library configured in
    `components.json`).
  - `lib/utils.ts` exports `cn()`.
  - `app/globals.css` rewritten to carry the `ui-context.md` theme, and
    `app/layout.tsx` switched from Geist to Manrope.

### Verification of `01-design-system.md`

| Check from the spec | Result |
| --- | --- |
| All components import without errors | `npx tsc --noEmit` → exit 0 against a temporary file importing every primitive and its sub-parts; the file was deleted afterwards |
| `cn()` works properly | 7/7 cases pass — Tailwind conflict resolution (`px-2 py-1` + `px-4` → `py-1 px-4`), last-wins radius merge, clsx conditional/object/array syntax, `className` override, and no false merge between `text-moss` and `bg-moss` |
| No default light styling appears | Compiled CSS contains **zero** occurrences of shadcn's default neutral palette (`oklch(1 0 0)`, `oklch(0.145 0 0)`, `oklch(0.922 0 0)`, `oklch(0.97 0 0)`, `oklch(0.205 0 0)`) and **zero** `prefers-color-scheme` queries; `body` resolves to `--bg-base` / `--text-primary`, `html` to Manrope, and `rounded-lg/xl/4xl` to 12px/16px/9999px |
| `npm run build` passes | ✅ compiled in 4.0s, 4 static pages |
| `npm run lint` passes | ✅ exit 0 |

## In Progress

Nothing — `01-design-system.md` is complete.

## Next Up

1. `prisma/schema.prisma` + `lib/db/` Prisma client (server-only).
2. Clerk auth and the PIN-unlock layer in `lib/auth/` — the `input-otp`
   primitive is already in place for the PIN entry UI.
3. Phase 1 — core data entry for one module end to end. Per
   `ai-workflow-rules.md`, Phase 3 (PowerSync offline sync) does not
   start until Phase 1 is complete.
4. `components/farm/` composed components (metric cards, the "needs
   attention" list, quantity steppers) once there is real data to show.

## Open Questions

1. **Worker vs. owner visual treatment.** `ui-context.md` calls owner
   screens "softer, layered" and worker screens "flat and
   high-contrast", but the concrete difference (shadow, ring, spacing,
   type scale) isn't defined. Needs resolving in `ui-context.md`
   before module UI work starts.
2. **Primary action button size.** `ui-context.md` fixes the radius at
   16px but not the height or type scale of the dominant "Log milk" /
   "Checkout" button. The shadcn `lg` size is `h-9`, which is likely too
   small for outdoor one-handed use. Resolve before building
   `components/farm/`.
3. **App metadata.** `app/layout.tsx` still carries the create-next-app
   title and description. Left alone as out of scope for this spec;
   fix when the app shell is built.
4. **Sidebar tokens.** `--sidebar-*` variables are mapped to the
   palette for completeness, but no layout in `ui-context.md` uses a
   sidebar. Drop them if a sidebar never materialises.

## Architecture Decisions

- **shadcn/ui confirmed** as the component library, resolving the
  "assumed — confirm" notes that were in `architecture.md` and
  `ui-context.md`. Both files have been updated.
- **`field` replaces `form`.** This registry version ships
  `components/ui/field.tsx` instead of the older `form` component;
  `form` resolves in the registry but generates no files. `Field` is
  the form-composition primitive going forward.
- **`cn()` comes from the `cn` package**, shadcn's current convention
  and a drop-in replacement for `clsx` + `tailwind-merge` with the same
  API. `lib/utils.ts` re-exports it, so both `@/lib/utils` and `cn`
  resolve to the same helper. Verified behaviourally, not assumed.
- **Theme applied by token remapping, never by editing primitives.**
  `app/globals.css` redefines shadcn's semantic variables in terms of
  the `ui-context.md` palette, so `components/ui/*` stays exactly as
  generated and remains a protected directory.
- **`--primary` is `--text-primary`** (deep olive-charcoal), not one of
  the module accents — `ui-context.md` explicitly rejects a single
  generic brand colour, and the three accents must keep meaning "which
  module".
- **`--secondary`, `--muted` and `--accent` all resolve to
  `--border-default`.** Mapping them to `--bg-base` would have made
  ghost/outline hover states invisible on the page background. The
  trade-off is that an outline button's border matches its own hover
  fill; shadcn's own defaults collapse the same way.
- **The `dark` variant is kept but neutered.** It stays scoped to a
  `.dark` ancestor the app never renders. Deleting `@custom-variant
  dark` would make Tailwind fall back to `prefers-color-scheme: dark`
  and activate the `dark:` utilities baked into the generated
  primitives — the exact behaviour `code-standards.md` forbids. The
  `.dark` palette block itself was removed, `color-scheme: light` is
  set on `:root`, and `<Toaster theme="light" />` overrides the
  generated Toaster's next-themes `system` default.

## Session Notes

- Next.js here is 16.x — conventions differ from older App Router
  versions. Consult `node_modules/next/dist/docs/` before writing
  framework code.
- The shadcn CLI is interactive by default; `init` needs an explicit
  `-b <base>` and `-p <preset>` to run unattended.
- `next dev` rewrites the `nextjs-agent-rules` block in `AGENTS.md`;
  committing that change alongside real work keeps the tree clean.
- `--font-sans` is declared in an **unlayered** `:root` block in
  `app/globals.css`, which is what makes it win over the
  self-referential `--font-sans: var(--font-sans)` Tailwind emits into
  `@layer theme`. Don't move that block inside a layer.
