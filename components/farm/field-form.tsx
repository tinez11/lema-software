"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createFieldAction } from "@/app/(app)/land/actions"
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH } from "@/lib/land-config"

// Owner-only registry work, so it follows the owner treatment: 1px edge,
// shadow, `p-6`, a primary action sized to its content. A worker never sees
// this form — and the action refuses it even if they reach it.
//
// A plain form rather than a management screen: there is no editing, no
// deleting and no list beyond what the crop cycle picker shows. That is what
// the spec asked for, and a registry nobody has filled in yet does not need
// more.

/**
 * Owner-only form for registering a field. Rendered only inside the owner
 * branch of `/land`, and `createFieldAction` refuses a non-owner regardless
 * — the hiding is tidiness, the action is the boundary.
 */
export function FieldForm() {
  const [name, setName] = useState("")
  const [sizeAcres, setSizeAcres] = useState("")
  const [locationNote, setLocationNote] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [pending, startTransition] = useTransition()

  /** Sends the form and turns each typed result into something to read. */
  function save() {
    if (pending || name.trim() === "") return

    setFeedback(null)

    startTransition(async () => {
      try {
        // An empty box means "not given", not zero — the column is nullable and
        // a field whose size nobody recorded is not a field of nought acres.
        const parsedAcres = sizeAcres.trim() === "" ? null : Number(sizeAcres)

        const result = await createFieldAction({
          name,
          sizeAcres: parsedAcres,
          locationNote,
        })

        switch (result.status) {
          case "ok":
            setName("")
            setSizeAcres("")
            setLocationNote("")
            setFailed(false)
            setFeedback(`${result.name} added.`)
            return
          case "not-owner":
            setFailed(true)
            setFeedback("Only the owner can add a field.")
            return
          case "invalid":
            setFailed(true)
            setFeedback(result.message)
            return
          case "not-allowed":
            setFailed(true)
            setFeedback("You're not signed in. Open the app again.")
            return
        }
      } catch {
        setFailed(true)
        setFeedback("No connection — the field wasn't saved.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-base font-semibold">Add a field</h3>

      <div className="flex flex-col gap-2">
        <Label htmlFor="field-name">Name</Label>
        <Input
          id="field-name"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(event) => setName(event.target.value)}
          placeholder="North paddock"
          disabled={pending}
          className="h-11 rounded-lg"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="field-acres">Size in acres (optional)</Label>
        <Input
          id="field-acres"
          inputMode="decimal"
          value={sizeAcres}
          onChange={(event) => setSizeAcres(event.target.value)}
          placeholder="2.5"
          disabled={pending}
          className="h-11 rounded-lg"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="field-note">Location note (optional)</Label>
        <Input
          id="field-note"
          value={locationNote}
          maxLength={MAX_NOTE_LENGTH}
          onChange={(event) => setLocationNote(event.target.value)}
          placeholder="Past the dam, left of the track"
          disabled={pending}
          className="h-11 rounded-lg"
        />
      </div>

      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className={failed ? "text-sm text-destructive" : "text-sm text-gold"}
        >
          {feedback}
        </p>
      )}

      <Button
        onClick={save}
        disabled={pending || name.trim() === ""}
        className="self-start rounded-lg"
      >
        {pending ? "Adding…" : "Add field"}
      </Button>
    </div>
  )
}
