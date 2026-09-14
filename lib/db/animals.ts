import "server-only"

import type { AnimalStatus, Prisma } from "@prisma/client"

import { prisma } from "./client"
import { toCentsOrNull } from "./money"

// Thin read helpers for the Cows & Milk animal registry and the health and
// breeding records that hang off an animal. Herd-total milk lives in
// `./milk` — it is never recorded per animal.
//
// Vet cost is owner-only (architecture.md, invariant 2): `getHealthRecords()`
// leaves `cost` out of its select, and `getHealthRecordsWithFinancials()` may
// only be called once the caller has verified `role === OWNER`.

/** Every HealthRecord column except `cost`. */
const healthRecordSafeSelect = {
  id: true,
  clientId: true,
  animalId: true,
  date: true,
  type: true,
  notes: true,
  vetName: true,
  deviceId: true,
  createdAt: true,
  updatedAt: true,
  recordedById: true,
} satisfies Prisma.HealthRecordSelect

// ───────────── Registry (no financial columns) ─────────────

/**
 * The herd, by tag number. Pass a status to narrow it — an active-only list is
 * what most screens want, since a sold or dead animal stays in the registry
 * for the health and breeding history hanging off it.
 */
export function getAnimals(options: { status?: AnimalStatus } = {}) {
  return prisma.animal.findMany({
    where: options.status ? { status: options.status } : undefined,
    orderBy: { tagNumber: "asc" },
  })
}

/** One animal, or null. The id is the cuid, not the tag painted on the ear. */
export function getAnimalById(id: string) {
  return prisma.animal.findUnique({ where: { id } })
}

/**
 * One animal by the tag number a worker can actually read off the animal.
 * `tagNumber` is unique in the schema, so this is a lookup, not a search.
 */
export function getAnimalByTagNumber(tagNumber: string) {
  return prisma.animal.findUnique({ where: { tagNumber } })
}

// ───────────── Health ─────────────

/**
 * Vaccinations, illnesses and treatments, newest first. The safe path: its
 * explicit select leaves `cost` out, so a worker screen can call it freely
 * (invariant 2). Use `getHealthRecordsWithFinancials()` when the vet bill is
 * actually needed and the caller has checked `role === OWNER`.
 */
export function getHealthRecords(
  options: { animalId?: string; take?: number } = {}
) {
  return prisma.healthRecord.findMany({
    where: options.animalId ? { animalId: options.animalId } : undefined,
    select: healthRecordSafeSelect,
    orderBy: { date: "desc" },
    take: options.take,
  })
}

/**
 * Owner-only: includes the vet cost, as `costCents`. Verify `role === OWNER`
 * before calling.
 *
 * `cost` leaves as an integer number of cents and under a renamed key, never
 * as a `Decimal` — see `lib/db/money.ts`. The rename is the point: a bare
 * `cost: 4550` reads as 4,550 currency units to the next person, `costCents`
 * does not.
 */
export async function getHealthRecordsWithFinancials(
  options: { animalId?: string; take?: number } = {}
) {
  const records = await prisma.healthRecord.findMany({
    where: options.animalId ? { animalId: options.animalId } : undefined,
    orderBy: { date: "desc" },
    take: options.take,
  })

  return records.map(({ cost, ...record }) => ({
    ...record,
    costCents: toCentsOrNull(cost),
  }))
}

// ───────────── Breeding (no financial columns) ─────────────

/**
 * Matings and calvings, newest mating first. Ordered by `matingDate` rather
 * than `createdAt` because a record is often entered days after the event.
 */
export function getBreedingRecords(
  options: { animalId?: string; take?: number } = {}
) {
  return prisma.breedingRecord.findMany({
    where: options.animalId ? { animalId: options.animalId } : undefined,
    orderBy: { matingDate: "desc" },
    take: options.take,
  })
}

/** Breedings still awaiting a calving — the source of dashboard reminders. */
export function getOpenBreedingRecords() {
  return prisma.breedingRecord.findMany({
    where: { actualCalvingDate: null },
    orderBy: { expectedCalvingDate: "asc" },
  })
}
