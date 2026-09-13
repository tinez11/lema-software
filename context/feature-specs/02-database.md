Read `Agents.md` before starting

Were adding the central data layer: the Prisma schema and a server-only client.

Copy `schema.prisma` (already defined in project context / architecture.md)
into `prisma/schema.prisma` as-is — this is the single source of truth,
do not redesign or rename models.

Install and configure Prisma with a PostgreSQL datasource (`DATABASE_URL`
from environment).

Run the initial migration.

Create `lib/db/client.ts` exporting a singleton `PrismaClient` instance
(guard against creating multiple instances under dev hot reload).

Create thin query-helper modules per module, not full business logic yet:
- lib/db/animals.ts
- lib/db/milk.ts
- lib/db/land.ts
- lib/db/shop.ts

Do not add API routes or server actions yet — this unit is schema + client
+ query helpers only.

Do not modify `components/ui/*`.

### Check when done
- `npx prisma validate` passes
- `npx prisma migrate dev` runs clean against a local Postgres instance
- `lib/db/client.ts` exports a single shared Prisma client, verified not
  to spawn duplicate instances on hot reload
- `npm run build` passes
- `npm run lint` passes


