import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

// Seeds the owner's `User` row. The Clerk webhook creates everyone as a
// WORKER, because Clerk has no concept of which account owns the farm — so
// the owner is promoted here, once, by hand.
//
//   npm run seed:owner -- user_123abc "Grace Lema"
//
// The id is the Clerk user id, visible in the Clerk dashboard or in
// `clerk users list`.

async function main() {
  const [id, name] = process.argv.slice(2)

  if (!id || !name) {
    console.error('Usage: npm run seed:owner -- <clerk-user-id> "<name>"')
    process.exitCode = 1
    return
  }

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env first.")
    process.exitCode = 1
    return
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

  try {
    const owner = await prisma.user.upsert({
      where: { id },
      create: { id, name, role: "OWNER", active: true },
      update: { role: "OWNER", active: true },
    })

    console.log(`Owner ready: ${owner.name} (${owner.id})`)
  } finally {
    await prisma.$disconnect()
  }
}

// Not top-level `await`: tsx compiles a plain .ts file as CommonJS, which
// rejects it outright.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
