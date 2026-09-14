import "server-only"

// Civil days, shared by every model with a `@db.Date` column — `MilkRecord`,
// `CropCycle`, `HarvestRecord`, `InputRecord`.
//
// A Postgres `date` has no time and no zone, and Prisma reads one back as
// midnight UTC. So every date written has to be built the same way, or a
// stored date never compares equal to "today" and `MilkRecord`'s
// `@@unique([date, session])` ends up guarding the wrong thing. One
// conversion, used by every module, is what keeps that true.

/**
 * The value `@db.Date` stores for the civil day `at` falls on: midnight UTC,
 * with the time of day discarded.
 *
 * The civil day comes from the *server's* timezone; see open question 12 in
 * `progress-tracker.md` about pinning that to the farm's own timezone before
 * this runs anywhere but a local machine.
 */
export function farmDate(at: Date = new Date()): Date {
  // Idempotent on a value that is already a civil day.
  //
  // The local getters below turn an *instant* into the day it falls on where
  // the server stands. Applied to a value that is already midnight UTC — what
  // this function and `parseFarmDate()` both return, and what Prisma reads a
  // `@db.Date` back as — they shift it a day west of Greenwich: 13 September
  // at 00:00Z is 12 September at 19:00 in UTC-5, so a second pass stores the
  // 12th. `createCropCycle` did exactly that, normalising a date the action
  // had already normalised, and would have filed every planting date a day
  // early on a server anywhere in the Americas.
  //
  // The one case this reads differently: `farmDate()` called in the
  // millisecond of midnight UTC takes the UTC day rather than the local one.
  // Defensible either way, and vanishingly rare against a bug that would have
  // been silent and permanent.
  if (isCivilDay(at)) return new Date(at.getTime())

  return new Date(Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()))
}

/** Whether a value is already exactly midnight UTC, i.e. a canonical day. */
function isCivilDay(at: Date): boolean {
  return (
    at.getUTCHours() === 0 &&
    at.getUTCMinutes() === 0 &&
    at.getUTCSeconds() === 0 &&
    at.getUTCMilliseconds() === 0
  )
}

/**
 * Reads a `YYYY-MM-DD` string — what an `<input type="date">` submits — into
 * the same midnight-UTC value `farmDate()` produces. Returns null for anything
 * that isn't a real calendar day, so a caller can reject it rather than
 * writing an `Invalid Date`.
 *
 * Parsed by hand rather than through `new Date(string)`: the built-in parse
 * treats a bare date as UTC but a date *with* a time as local, and accepts
 * enough near-misses ("2026-02-31") to roll silently into March.
 */
export function parseFarmDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())

  if (!match) return null

  const [, year, month, day] = match.map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))

  // A rolled-over date (31 February becoming 3 March) comes back with
  // different parts than it went in with, which is how an impossible day is
  // caught without a calendar table.
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }

  return parsed
}

/** `YYYY-MM-DD`, the form an `<input type="date">` expects back. */
export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10)
}
