import "server-only"

import type { AnimalStatus, Prisma } from "@prisma/client"

import { prisma } from "./client"

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

export function getAnimals(options: { status?: AnimalStatus } = {}) {
  return prisma.animal.findMany({
    where: options.status ? { status: options.status } : undefined,
    orderBy: { tagNumber: "asc" },
  })
}

export function getAnimalById(id: string) {
  return prisma.animal.findUnique({ where: { id } })
}

export function getAnimalByTagNumber(tagNumber: string) {
  return prisma.animal.findUnique({ where: { tagNumber } })
}

// ───────────── Health ─────────────

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

/** Owner-only: includes `cost`. Verify `role === OWNER` before calling. */
export function getHealthRecordsWithFinancials(
  options: { animalId?: string; take?: number } = {}
) {
  return prisma.healthRecord.findMany({
    where: options.animalId ? { animalId: options.animalId } : undefined,
    orderBy: { date: "desc" },
    take: options.take,
  })
}

// ───────────── Breeding (no financial columns) ─────────────

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
