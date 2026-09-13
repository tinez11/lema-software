import { redirect } from "next/navigation"

import { clearUnlock } from "@/lib/auth/unlock"

// Where Clerk lands the browser after signing out. The unlock cookie is
// httpOnly, so only the server can drop it — without this it would survive a
// sign-out and let the same worker back in on the next sign-in without a PIN.
export async function GET() {
  await clearUnlock()
  redirect("/sign-in")
}
