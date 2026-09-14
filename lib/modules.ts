import type { Module } from "@prisma/client"

// The three business lines, and where each one's screen lives.
//
// One registry rather than a link hardcoded per page: this is what decides
// which modules a user is offered, and it is the only place a module's route
// or accent is written down. Not `server-only` — the type is all a client
// component needs, and nothing here touches Prisma.

export type ModuleDefinition = {
  value: Module
  label: string
  /**
   * `null` while a module has no screen, so the nav can list it for assignment
   * without offering a 404. All three are routed now; the type stays nullable
   * because that is the honest shape for a registry a fourth module could join.
   */
  href: string | null
  accent: "moss" | "gold" | "ochre"
}

export const MODULES: readonly ModuleDefinition[] = [
  // Milk lives at `/`, not `/milk`: home is still the entry screen both roles
  // land on, and `app/(app)/milk/` holds only its actions.
  { value: "MILK", label: "Cows & Milk", href: "/", accent: "moss" },
  { value: "LAND", label: "Land & Produce", href: "/land", accent: "gold" },
  { value: "SHOP", label: "Shop", href: "/shop", accent: "ochre" },
]

/**
 * The definition for one module.
 *
 * Throws rather than returning undefined: `Module` is a closed enum, so a
 * miss means `MODULES` has fallen out of step with the schema, and that
 * should fail loudly at the call site instead of rendering a blank label.
 */
export function moduleDefinition(value: Module): ModuleDefinition {
  const found = MODULES.find((module) => module.value === value)

  if (!found) throw new Error(`No definition for module ${value}`)

  return found
}

/**
 * Whether an assignment covers a module.
 *
 * The single definition of "empty means all", so the nav and the
 * authorization check in `lib/auth/roles.ts` can never drift into disagreeing
 * about who may reach what.
 */
export function isModuleAssigned(
  assignedModules: readonly Module[],
  module: Module
): boolean {
  return assignedModules.length === 0 || assignedModules.includes(module)
}

/**
 * The modules a user is offered.
 *
 * An **empty** assignment means all of them. That is what makes the column
 * additive: every row that existed before it did has an empty array and so
 * loses nothing, and an owner the farm never narrows keeps the whole app. A
 * non-empty list is read as a deliberate restriction.
 *
 * Order follows `MODULES`, not the order the values happen to be stored in, so
 * the nav does not reshuffle itself when an assignment is edited.
 */
export function modulesFor(
  assignedModules: readonly Module[]
): readonly ModuleDefinition[] {
  return MODULES.filter((module) =>
    isModuleAssigned(assignedModules, module.value)
  )
}
