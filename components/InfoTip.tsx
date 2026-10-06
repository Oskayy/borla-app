'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Info } from 'lucide-react'

// A small "i" next to a label or button. Tap (or hover/focus) to read what it does; replaces always-visible hints.
export default function InfoTip({ text, label = 'More information' }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const box = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={box} className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="-m-3 grid size-11 place-items-center rounded-full text-ink-3 transition hover:text-ink"
      >
        <Info aria-hidden className="size-4" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-40 mt-1.5 w-64 -translate-x-1/2 rounded-control bg-ink px-3 py-2 text-left text-xs font-normal leading-relaxed text-canvas shadow-lift"
        >
          {text}
        </span>
      )}
    </span>
  )
}
