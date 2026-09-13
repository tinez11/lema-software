import "server-only"

import type { CropCycleStatus, Prisma } from "@prisma/client"

import { prisma } from "./client"

// Thin read helpers for Land & Produce: the field registry, crop cycles, and
// the input/harvest records attached to a cycle.
//
// Input cost is owner-only (architecture.md, invariant 2). The plainly named
// helpers below select their columns explicitly and leave `cost` out; the
// `...WithFinancials()` variants return it and may only be called once the
// caller has verified `role === OWNER`.

/** Every InputRecord column except `cost`. */
const inputRecordSafeSelect = {
  id: true,
  clientId: true,
  cropCycleId: true,
  date: true,
  type: true,
  quantity: true,
  deviceId: true,
  createdAt: true,
  updatedAt: true,
  recordedById: true,
} satisfies Prisma.InputRecordSelect

// ───────────── Fields and cycles (no financial columns) ─────────────

export function getFields() {
  return prisma.field.findMany({ orderBy: { name: "asc" } })
}

export function getFieldById(id: string) {
  return prisma.field.findUnique({ where: { id } })
}

export function getCropCycles(
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

// ───────────── Inputs ─────────────

export function getInputRecords(
  options: { cropCycleId?: string; take?: number } = {}
) {
  return prisma.inputRecord.findMany({
    where: options.cropCycleId ? { cropCycleId: options.cropCycleId } : undefined,
    select: inputRecordSafeSelect,
    orderBy: { date: "desc" },
    take: options.take,
  })
}

/** Owner-only: includes `cost`. Verify `role === OWNER` before calling. */
export function getInputRecordsWithFinancials(
  options: { cropCycleId?: string; take?: number } = {}
) {
  return prisma.inputRecord.findMany({
    where: options.cropCycleId ? { cropCycleId: options.cropCycleId } : undefined,
    orderBy: { date: "desc" },
    take: options.take,
  })
}

/** Owner-only: total input cost for one cycle. Verify `role === OWNER` first. */
export function sumInputCostWithFinancials(cropCycleId: string) {
  return prisma.inputRecord.aggregate({
    where: { cropCycleId },
    _sum: { cost: true },
  })
}

// ───────────── Harvests (quantities only, no financial columns) ─────────────

export function getHarvestRecords(
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
