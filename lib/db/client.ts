import "server-only"

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

// Prisma 7 has no built-in connection layer: the client reaches Postgres
// through a driver adapter, and the URL comes from the environment rather
// than from `schema.prisma`.
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill it in."
    )
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

// `next dev` re-evaluates modules on every hot reload, which would open a new
// connection pool each time. Caching the instance on `globalThis` — which
// survives reload — keeps exactly one client per process. Production builds
// evaluate the module once, so the cache is skipped there.
const globalForPrisma = globalThis as typeof globalThis & {
  prismaClient?: PrismaClient
}

export const prisma = globalForPrisma.prismaClient ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaClient = prisma
}
