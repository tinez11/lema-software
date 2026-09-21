"use client"

import type { ComponentProps } from "react"
import { useFormStatus } from "react-dom"
import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// The write-action button, everywhere in the app: it knows when its own form is
// in flight, so no screen threads a `pending` flag down to it.
//
// A wrapper over `components/ui/button.tsx` rather than an edit to it.
// `components/ui/*` is generated and protected (`ai-workflow-rules.md`), and a
// primitive that reached into form context would stop being one.
//
// `useFormStatus()` is React's own action-pending mechanism and it reads the
// nearest `<form action>` ancestor, so this button only reports pending inside
// one. Every write in `components/farm/` is dispatched through
// `<form action={submit}>` for that reason, even where the values travel as
// React state rather than as `FormData` — see `lib/use-single-flight.ts`, which
// is the half that makes a double tap one submission rather than two.
//
// No new visual language: the same `Button` at the same size, with its label
// swapped for a spinner. The label stays in the layout while it is hidden so a
// button sized to its content does not shrink under the thumb that is pressing
// it.

type SubmitButtonProps = Omit<
  ComponentProps<typeof Button>,
  "type" | "asChild"
> & {
  /** Names the wait for a screen reader, since the label becomes a spinner. */
  pendingLabel?: string
}

export function SubmitButton({
  children,
  className,
  disabled,
  pendingLabel = "Saving…",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn("relative", className)}
      {...props}
    >
      <span className={cn(pending && "invisible")}>{children}</span>
      {pending && (
        <span className="absolute inset-0 flex items-center justify-center">
          {/* `Loader2` is lucide v1's alias for `LoaderCircle`. */}
          <Loader2Icon className="size-5 animate-spin" aria-hidden />
          <span className="sr-only">{pendingLabel}</span>
        </span>
      )}
    </Button>
  )
}
