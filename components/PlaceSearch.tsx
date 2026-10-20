'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { FIELD } from '@/components/ui'
import { dedupePlaces, matchLocal, parsePhoton, photonUrl, type LocalPlace, type PlaceHit } from '@/lib/place-parse'

export type { PlaceHit }

// The built-in list of neighbourhoods and towns (public/places/gh-places.json, ~19 KB), loaded once on first use.
let localList: Promise<LocalPlace[]> | null = null
function loadLocal(): Promise<LocalPlace[]> {
  localList ??= fetch('/places/gh-places.json')
    .then((r) => (r.ok ? r.json() : { places: [] }))
    .then((j: { places?: LocalPlace[] }) => j.places ?? [])
    .catch(() => {
      localList = null // try again next time
      return []
    })
  return localList
}

// Landmark answers already fetched this visit, so going back over a word costs nothing.
const remoteCache = new Map<string, PlaceHit[]>()

const ACCRA = { lat: 5.604, lng: -0.187 }

// Landmarks (schools, banks, hospitals, malls) from OpenStreetMap's Photon, asked straight from the phone (no
// detour through our server, which may be on another continent); our own server is the fallback.
async function remote(q: string, near: { lat: number; lng: number } | null, signal: AbortSignal): Promise<PlaceHit[] | { error: string }> {
  const key = `${q.toLowerCase()}|${(near ?? ACCRA).lat.toFixed(2)},${(near ?? ACCRA).lng.toFixed(2)}`
  const cached = remoteCache.get(key)
  if (cached) return cached
  let hits: PlaceHit[] | null = null
  try {
    const res = await fetch(photonUrl(q, near ?? ACCRA), { signal })
    if (res.ok) hits = parsePhoton(await res.json())
  } catch (e) {
    if (signal.aborted) throw e
  }
  if (!hits || hits.length === 0) {
    const params = new URLSearchParams({ q })
    if (near) {
      params.set('lat', near.lat.toFixed(3))
      params.set('lng', near.lng.toFixed(3))
    }
    const res = await fetch(`/api/places?${params}`, { signal })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (hits) return hits // Photon answered "nothing"; that stands
      return { error: res.status === 429 ? 'That is a lot of searches. Wait a little, or tap your home on the map.' : 'Search is not working just now. Tap your home on the map instead.' }
    }
    hits = data.places ?? []
  }
  remoteCache.set(key, hits!)
  return hits!
}

// A text box that suggests places as you type: neighbourhoods and towns at once from the built-in list, then
// landmarks a moment later. Picking one fills the box and calls `onPick`; typing freely is fine too, since the text
// is what gets saved. Arrow keys move through the list, Enter picks, Escape closes it.
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
  const [local, setLocal] = useState<PlaceHit[]>([])
  const [more, setMore] = useState<PlaceHit[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState('')
  const typed = useRef(false) // only search what the person typed, not text set by picking a suggestion
  const box = useRef<HTMLDivElement>(null)
  // Start fetching the built-in list as soon as the form shows, so the first letters typed already match.
  useEffect(() => {
    loadLocal()
  }, [])
  const nearRef = useRef(near ?? null)
  useEffect(() => {
    nearRef.current = near ?? null
  }, [near])

  useEffect(() => {
    if (!typed.current) return
    const q = value.trim()
    const ctrl = new AbortController()
    let stale = false

    // At once: neighbourhoods and towns from the built-in list.
    loadLocal().then((list) => {
      if (stale) return
      setLocal(matchLocal(list, q, nearRef.current))
      setActive(-1)
      setOpen(q.length >= 2)
    })

    // A moment later: landmarks.
    if (q.length < 3) {
      setMore([])
      setLoading(false)
      setNote('')
      return () => {
        stale = true
        ctrl.abort()
      }
    }
    const t = window.setTimeout(async () => {
      setLoading(true)
      try {
        const r = await remote(q, nearRef.current, ctrl.signal)
        if (stale) return
        if ('error' in r) {
          setMore([])
          setNote(r.error)
        } else {
          setMore(r)
          setNote('')
        }
        setOpen(true)
      } catch {
        // a newer search replaced this one
      } finally {
        if (!stale) setLoading(false)
      }
    }, 250)
    return () => {
      stale = true
      ctrl.abort()
      window.clearTimeout(t)
    }
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

  // The built-in list first (it is instant and has the areas people live in), then landmarks; one per place.
  const hits = dedupePlaces([...local, ...more], 8)
  const empty = hits.length === 0 && !loading && value.trim().length >= 3
  const message = note || (empty ? 'Nothing found. Try a nearby school, church, bank or junction, or tap your home on the map.' : '')

  function pick(h: PlaceHit) {
    typed.current = false
    onChange(h.detail ? `${h.name}, ${h.detail.split(',')[0]}` : h.name)
    onPick(h)
    setOpen(false)
    setLocal([])
    setMore([])
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

  const showList = open && (hits.length > 0 || loading || !!message)
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
        onFocus={() => {
          loadLocal() // fetch the list while the person starts typing
          if (hits.length) setOpen(true)
        }}
        onKeyDown={onKey}
        className={`${FIELD} pl-11 pr-10 ${invalid ? 'border-danger ring-3 ring-danger/15' : ''}`}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
      />
      {loading && <Loader2 aria-hidden className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-3" />}
      <span className="sr-only" aria-live="polite">
        {open ? (hits.length ? `${hits.length} places found` : message) : ''}
      </span>
      {showList && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-control bg-surface shadow-lift ring-1 ring-line">
          <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto p-1.5">
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
            {hits.length === 0 && message && <li className="px-3 py-2.5 text-sm text-ink-2">{message}</li>}
          </ul>
          <p className="flex items-center justify-between gap-2 border-t border-line px-3 py-1.5 text-[11px] text-ink-3">
            <span>{loading ? 'Looking for landmarks…' : hits.length ? 'Not here? Try a nearby landmark.' : ''}</span>
            <span>© OpenStreetMap</span>
          </p>
        </div>
      )}
    </div>
  )
}
