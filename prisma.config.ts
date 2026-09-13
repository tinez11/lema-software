import "dotenv/config"

import path from "node:path"
import { defineConfig, env } from "prisma/config"

// Prisma 7 no longer reads the connection URL from `schema.prisma` or loads
// `.env` on its own: migrate/introspect read it from here, and the runtime
// client gets it through the driver adapter in `lib/db/client.ts`.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
})
