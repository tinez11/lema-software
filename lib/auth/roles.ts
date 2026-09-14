import "server-only"

import type { Module } from "@prisma/client"

import { isModuleAssigned } from "../modules"
import type { AuthGate, CurrentUser } from "./session"

// Role checks on an already-resolved gate.
//
// Kept apart from `session.ts` for one concrete reason: that module imports
// Clerk's `auth()` at the top level, which drags in Next's client runtime and
// cannot be loaded outside a request. These functions are pure, so living here
// means they can be exercised directly against constructed gates — which is
// how the owner rule is actually verified rather than assumed.
//
// The type import above is erased at compile time, so nothing here loads
// `session.ts` at runtime.

export type OwnerCheck =
  | { ok: true; user: CurrentUser }
  | { ok: false; status: "not-owner" | "not-allowed" }

/**
 * Narrows a gate to a signed-in, unlocked **owner**.
 *
 * Pure, so an action calls it on the gate it already resolved — no second
 * round trip — and the check is the first thing that runs, before any input is
 * parsed and long before anything is written.
 *
 * `not-owner` stays distinct from `not-allowed` on purpose: a worker who
 * reaches an owner-only action should be told the rule, not handed a sign-in
 * message or a validation complaint about a field they filled in correctly.
 *
 * Note this is not a role *parameter* on a query helper — the thing
 * `code-standards.md` forbids. It is the caller resolving its own identity
 * before choosing a path, which is exactly what that rule asks for.
 */
export function requireOwner(gate: AuthGate): OwnerCheck {
  if (gate.state !== "ready") return { ok: false, status: "not-allowed" }
  if (gate.user.role !== "OWNER") return { ok: false, status: "not-owner" }

  return { ok: true, user: gate.user }
}

export type ModuleCheck =
  | { ok: true; user: CurrentUser }
  | { ok: false; status: "not-assigned" | "not-allowed" }

/**
 * Narrows a gate to someone who may use a given module.
 *
 * `User.assignedModules` was introduced to decide which links a worker is
 * offered. That made it a suggestion: a worker narrowed to the shop could
 * still type `/land` and log a harvest, so the narrowing was decoration. A
 * restriction any URL walks past is worse than no restriction, because it
 * reads as a control that is not there.
 *
 * Two things it deliberately does not change:
 *   - **Owners are never restricted.** They see every module by definition
 *     (`architecture.md`), so the assignment is not consulted for them.
 *   - **An empty assignment still means all three.** That is what kept the
 *     column additive when it arrived, and every existing row is empty — so
 *     this check refuses nobody today. It starts mattering the moment an owner
 *     narrows someone, which is the point at which they would expect it to.
 *
 * This is not the role parameter `code-standards.md` forbids: that rule is
 * about a *query helper* branching internally. This is a caller establishing
 * who it is speaking for before choosing a path, exactly like
 * `requireOwner()` beside it.
 */
export function requireModule(gate: AuthGate, module: Module): ModuleCheck {
  if (gate.state !== "ready") return { ok: false, status: "not-allowed" }
  if (gate.user.role === "OWNER") return { ok: true, user: gate.user }

  if (!isModuleAssigned(gate.user.assignedModules, module)) {
    return { ok: false, status: "not-assigned" }
  }

  return { ok: true, user: gate.user }
}
