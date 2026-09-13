import "server-only"

import type { CropCycleStatus } from "@prisma/client"

import { prisma } from "./client"

// Thin read helpers for Land & Produce: the field registry, crop cycles, and
// the input/harvest records attached to a cycle. Input cost is owner-only
// data — callers above this layer are responsible for that filtering.

export function listFields() {
  return prisma.field.findMany({ orderBy: { name: "asc" } })
}

export function getFieldById(id: string) {
  return prisma.field.findUnique({ where: { id } })
}

export function listCropCycles(
  options: { fieldId?: string; status?: CropCycleStatus } = {}
) {
  const { fieldId, status } = options

  return prisma.cropCycle.findMany({
    where: {
      ...(fieldId ? { fieldId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { plantingDate: "desc" },
  })
}

export function getCropCycleById(id: string) {
  return prisma.cropCycle.findUnique({ where: { id } })
}

export function listInputRecords(
  options: { cropCycleId?: string; take?: number } = {}
) {
  return prisma.inputRecord.findMany({
    where: options.cropCycleId ? { cropCycleId: options.cropCycleId } : undefined,
    orderBy: { date: "desc" },
    take: options.take,
  })
}

export function listHarvestRecords(
  options: { cropCycleId?: string; take?: number } = {}
) {
  return prisma.harvestRecord.findMany({
    where: options.cropCycleId ? { cropCycleId: options.cropCycleId } : undefined,
    orderBy: { date: "desc" },
    take: options.take,
  })
}

/** Harvested quantity for one cycle, in the unit each record was logged in. */
export function sumHarvestQuantity(cropCycleId: string) {
  return prisma.harvestRecord.groupBy({
    by: ["unit"],
    where: { cropCycleId },
    _sum: { quantity: true },
  })
}

/** Total input cost for one cycle — owner-only data. */
export function sumInputCost(cropCycleId: string) {
  return prisma.inputRecord.aggregate({
    where: { cropCycleId },
    _sum: { cost: true },
  })
}
