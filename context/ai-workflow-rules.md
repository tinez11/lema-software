# AI Workflow Rules

## Approach

Build this project incrementally using a spec-driven workflow. The
five other context files — `project-overview.md`, `architecture.md`,
`code-standards.md`, `ui-context.md`, and `schema.prisma` — define
what to build, how to build it, and the current state of progress.
Always implement against these specs; do not infer or invent product
behavior, data shapes, or visual style from scratch. Follow the
roadmap phases recorded in `progress-tracker.md` in order — don't
start Phase 3 (offline sync) work before Phase 1 (core data entry)
is complete end to end, for example.

## Scoping Rules

- Work on one feature unit or subsystem at a time
- Prefer small, verifiable increments over large
  speculative changes
- Do not combine unrelated system boundaries in a
  single implementation step

## When to Split Work

Split an implementation step if it combines:

- UI changes for one module with UI or data changes in a different
  module (e.g. touching both Cows & Milk and Shop in one step)
- Multiple unrelated API routes or server actions
- Behavior not clearly defined in the context files — stop and
  resolve it first rather than guessing

If a change cannot be verified end to end quickly,
the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent product behavior not defined in the
  context files
- If a requirement is ambiguous, resolve it in the
  relevant context file before implementing
- If a requirement is missing, add it as an open question
  in `progress-tracker.md` before continuing

## Protected Files

Do not modify the following unless explicitly instructed:

- `components/ui/*` — generated shadcn/ui primitives
- `prisma/schema.prisma` — treat schema changes as a deliberate,
  reviewed decision, not an incidental side effect of a feature change
- Any third-party library internals

## Keeping Docs in Sync

Update the relevant context file whenever implementation
changes:

- System architecture or boundaries → `architecture.md`
- Storage model decisions → `architecture.md` and `schema.prisma`
- Code conventions or standards → `code-standards.md`
- Feature scope → `project-overview.md`
- Visual/UI decisions → `ui-context.md`

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope
2. No invariant defined in `architecture.md` was violated
3. `progress-tracker.md` reflects the completed work
4. `npm run build` passes
