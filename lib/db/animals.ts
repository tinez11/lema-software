import "server-only"

import type { AnimalStatus } from "@prisma/client"

import { prisma } from "./client"

// Thin read helpers for the Cows & Milk animal registry and the health and
// breeding records that hang off an animal. Herd-total milk lives in
// `./milk` — it is never recorded per animal.

export function listAnimals(options: { status?: AnimalStatus } = {}) {
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

export function listHealthRecords(
  options: { animalId?: string; take?: number } = {}
) {
  return prisma.healthRecord.findMany({
    where: options.animalId ? { animalId: options.animalId } : undefined,
    orderBy: { date: "desc" },
    take: options.take,
  })
}

export function listBreedingRecords(
  options: { animalId?: string; take?: number } = {}
) {
  return prisma.breedingRecord.findMany({
    where: options.animalId ? { animalId: options.animalId } : undefined,
    orderBy: { matingDate: "desc" },
    take: options.take,
  })
}

/** Breedings still awaiting a calving — the source of dashboard reminders. */
export function listOpenBreedingRecords() {
  return prisma.breedingRecord.findMany({
    where: { actualCalvingDate: null },
    orderBy: { expectedCalvingDate: "asc" },
  })
}
