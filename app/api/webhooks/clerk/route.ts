import type { NextRequest } from "next/server"

import { verifyWebhook } from "@clerk/nextjs/webhooks"

import { upsertUserFromClerk } from "@/lib/db/users"

// Clerk calls this when the owner invites someone from the Clerk dashboard.
// There is no in-app invite screen: a worker exists in Clerk first, and this
// route is what gives them a matching Prisma row.
//
// The route is public in `proxy.ts` because Clerk's servers have no session.
// Its authentication is the Svix signature, verified before the payload is
// read — an unsigned or tampered body never reaches the database.

function nameFrom(data: {
  first_name?: string | null
  last_name?: string | null
  email_addresses?: { email_address: string }[]
  id: string
}): string {
  const full = [data.first_name, data.last_name].filter(Boolean).join(" ").trim()

  if (full) return full

  // Clerk invitations often carry no name at all, and `name` is required.
  return data.email_addresses?.[0]?.email_address ?? data.id
}

export async function POST(request: NextRequest) {
  let event

  try {
    event = await verifyWebhook(request)
  } catch {
    // Deliberately vague: a caller who cannot sign a payload learns nothing
    // about why it was refused.
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 })
  }

  if (event.type !== "user.created") {
    // Acknowledged, not acted on — Clerk retries anything it gets a non-2xx
    // for, and this unit only cares about creation.
    return Response.json({ data: { ignored: event.type } })
  }

  // Every new Clerk user is a WORKER. The owner's row is seeded directly
  // (`npm run seed:owner`) because Clerk has no way to know who the owner is.
  const user = await upsertUserFromClerk({
    id: event.data.id,
    name: nameFrom(event.data),
  })

  return Response.json({ data: { id: user.id, role: user.role } })
}
