import type { ReactNode } from "react"

// Shown when someone is signed into Clerk but the app cannot let them in:
// no Prisma row yet, or access revoked. Deliberately a dead end with no
// retry button — both states are resolved by the owner, not by the worker.
export function AuthNotice({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border-2 border-border bg-card p-5">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <div className="text-base text-muted-foreground">{children}</div>
      </div>
    </div>
  )
}
