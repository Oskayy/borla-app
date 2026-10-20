'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { FIELD } from '@/components/ui'

export interface PlaceHit {
  id: string
  name: string
  detail: string
  lat: number
  lng: number
}

// A text box that suggests areas, streets and landmarks as you type (from /api/places). Picking one fills the box
// and calls `onPick`; typing freely is fine too, since the text is what gets saved. Waits for 3 letters and a short
// pause before asking. Arrow keys move through the list, Enter picks, Escape closes it.
export default function PlaceSearch({
  id,
  value,
  onChange,
  onPick,
  near,
  invalid,
  describedBy,
  placeholder,
}: {
  id: string
  value: string
  onChange: (text: string) => void
  onPick: (hit: PlaceHit) => void
  near?: { lat: number; lng: number } | null
  invalid?: boolean
  describedBy?: string
  placeholder?: string
}) {
  const listId = useId()
  const [hits, setHits] = useState<PlaceHit[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState('')
  const typed = useRef(false) // only search what the person typed, not text set by picking a suggestion
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = value.trim()
    if (!typed.current || q.length < 3) return
    const ctrl = new AbortController()
    const t = window.setTimeout(async () => {
      setLoading(true)
      setNote('')
      try {
        const params = new URLSearchParams({ q })
        if (near) {
          params.set('lat', near.lat.toFixed(3))
          params.set('lng', near.lng.toFixed(3))
        }
        const res = await fetch(`/api/places?${params}`, { signal: ctrl.signal })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setHits([])
          setNote(res.status === 429 ? 'That is a lot of searches. Wait a little, or tap your home on the map.' : data.error || 'Search is not working just now. Tap your home on the map instead.')
        } else {
          setHits(data.places ?? [])
          setNote((data.places ?? []).length ? '' : 'Nothing found. Try a nearby school, church, bank or junction, or tap your home on the map.')
        }
        setActive(-1)
        setOpen(true)
      } catch {
        // a newer search replaced this one, or the connection dropped
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 350)
    return () => {
      ctrl.abort()
      window.clearTimeout(t)
    }
    // `near` only sorts results; a moved pin doesn't need a new search
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Close the list on a tap anywhere else.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  function pick(h: PlaceHit) {
    typed.current = false
    onChange(h.detail ? `${h.name}, ${h.detail.split(',')[0]}` : h.name)
    onPick(h)
    setOpen(false)
    setHits([])
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || hits.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % hits.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a <= 0 ? hits.length - 1 : a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(hits[Math.max(0, active)])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && (hits.length > 0 || !!note)
  return (
    <div ref={box} className="relative">
      <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-3" />
      <input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => {
          typed.current = true
          onChange(e.target.value)
        }}
        onFocus={() => hits.length && setOpen(true)}
        onKeyDown={onKey}
        className={`${FIELD} pl-11 pr-10 ${invalid ? 'border-danger ring-3 ring-danger/15' : ''}`}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
      />
      {loading && <Loader2 aria-hidden className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-3" />}
      <span className="sr-only" aria-live="polite">
        {open ? (hits.length ? `${hits.length} places found` : note) : ''}
      </span>
      {showList && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-control bg-surface p-1.5 shadow-lift ring-1 ring-line">
          {hits.map((h, i) => (
            <li
              key={h.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => e.preventDefault()} // keep focus in the box until the tap lands
              onClick={() => pick(h)}
              className={`flex cursor-pointer items-start gap-3 rounded-[10px] px-3 py-2.5 ${i === active ? 'bg-action-wash' : 'hover:bg-canvas'}`}
            >
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium">{h.name}</span>
                {h.detail && <span className="block truncate text-sm text-ink-3">{h.detail}</span>}
              </span>
            </li>
          ))}
          {hits.length === 0 && note && <li className="px-3 py-2.5 text-sm text-ink-2">{note}</li>}
        </ul>
      )}
    </div>
  )
}
