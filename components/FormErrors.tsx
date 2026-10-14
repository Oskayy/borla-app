'use client'

import { useEffect, useRef } from 'react'
import { AlertCircle } from 'lucide-react'

export interface FieldProblem {
  field: string // the input's id
  text: string
}

// Shown at the top of a form after a submit that failed checks (the GOV.UK pattern): it takes focus so screen
// readers announce it, and each line jumps to its field. The same messages also appear under each field.
// `attempt` changes on every failed submit, so focus moves here each time.
export function ErrorSummary({ problems, attempt }: { problems: FieldProblem[]; attempt: number }) {
  const box = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (problems.length > 0) box.current?.focus()
    // Only on a new attempt, not while the person is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  if (problems.length === 0) return null
  return (
    <div ref={box} tabIndex={-1} role="alert" aria-labelledby="error-summary-title" className="rounded-control bg-danger-wash p-4 outline-none ring-1 ring-danger/40 focus-visible:ring-2">
      <p id="error-summary-title" className="flex items-center gap-2 font-semibold text-danger">
        <AlertCircle aria-hidden className="size-4 shrink-0" /> Please fix {problems.length === 1 ? 'this' : `these ${problems.length} things`}
      </p>
      <ul className="mt-2 grid gap-1 pl-6">
        {problems.map((p) => (
          <li key={p.field}>
            <a
              href={`#${p.field}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(p.field)?.focus()
              }}
              className="text-sm font-medium text-danger underline underline-offset-2"
            >
              {p.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

// The message under one field. Give the field aria-describedby={`${id}-error`} and aria-invalid while it shows.
export function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null
  return (
    <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger">
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" /> {text}
    </p>
  )
}

// aria props for a field with an optional hint and error.
export function fieldA11y(id: string, error?: string, hintId?: string) {
  const ids = [hintId, error ? `${id}-error` : undefined].filter(Boolean).join(' ')
  return { 'aria-invalid': error ? true : undefined, 'aria-describedby': ids || undefined } as const
}
