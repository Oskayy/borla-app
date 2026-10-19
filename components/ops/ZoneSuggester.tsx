'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { CheckCircle2, RotateCcw, Sparkles } from 'lucide-react'
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'
import { Chip, PANEL, Result, SELECT } from '@/components/ops/kit'
import Skeleton from '@/components/kit/Skeleton'
import { areaKm2, isShapeError, parseBoundary, type ZoneBoundary } from '@/lib/zone-shape'
import { MAX_SCAN_KM2, type Suggestion } from '@/lib/zone-suggest'
import type { OtherZone } from '@/components/ops/ZoneDrawMap'
import type { ZoneDraft } from '@/components/ZoneForm'

const ZoneDrawMap = dynamic(() => import('@/components/ops/ZoneDrawMap'), { ssr: false, loading: () => <Skeleton className="h-[520px] rounded-none" /> })

const SIZES = [
  { value: 2, label: 'Small (about 2 km²)' },
  { value: 5, label: 'Medium (about 5 km²)' },
  { value: 10, label: 'Large (about 10 km²)' },
]

const TIER_ORDER: Record<string, number> = { PREMIUM: 0, STANDARD: 1, BASIC: 2 }
const tierName = (t: string) => t.charAt(0) + t.slice(1).toLowerCase()
const tierTone = (t: string) => (t === 'PREMIUM' ? 'ops' : t === 'BASIC' ? 'driver' : 'neutral') as 'ops' | 'driver' | 'neutral'

// "Suggest zones": draw the area to cover; Trashit proposes outlines (one per named neighbourhood in OpenStreetMap,
// or a grid) and a tier for each from building size and density and its own orders. Nothing is saved here: Review
// opens each one in the zone form, where it is checked and created like a drawn zone.
export default function ZoneSuggester({ others, onReview, saved }: { others: OtherZone[]; onReview: (d: ZoneDraft) => void; saved: Set<string> }) {
  const [open, setOpen] = useState(false)
  const [scan, setScan] = useState<ZoneBoundary | null>(null)
  const [city, setCity] = useState('')
  const [size, setSize] = useState(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ suggestions: Suggestion[]; usedPlaces: number; note: string | null; run: number } | null>(null)

  const shape = scan ? parseBoundary(scan) : null
  const shapeError = shape && isShapeError(shape) ? shape.error : null
  const km2 = scan && !shapeError ? areaKm2(scan) : null
  const tooBig = km2 != null && km2 > MAX_SCAN_KM2
  const preview = useMemo(() => result?.suggestions.map((s) => ({ name: s.name, tier: s.tier, boundary: s.boundary })) ?? [], [result])

  async function run() {
    setError('')
    if (!scan || shapeError || tooBig) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/zones/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ area: scan, targetKm2: size }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(res.status === 429 ? 'That is a lot of scans for one hour. Please wait a while and try again.' : data.error || 'Could not suggest zones')
      setResult({ ...data, run: Date.now() })
    } catch {
      setError('Could not reach Trashit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <section aria-labelledby="h-suggest" className={`${PANEL} flex flex-wrap items-center gap-4`}>
        <div className="min-w-0 flex-1">
          <h2 id="h-suggest" className="text-lg font-semibold tracking-tight">
            Suggest zones
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">Draw an area and Trashit proposes zones and tiers from neighbourhood names, building size and density, and its own orders. You review each one before it is created.</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className={BUTTON_QUIET}>
          <Sparkles aria-hidden className="size-4" /> Suggest zones
        </button>
      </section>
    )
  }

  const key = (i: number) => `${result?.run}-${i}`
  return (
    <section aria-labelledby="h-suggest" className={`${PANEL} grid gap-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="h-suggest" className="text-lg font-semibold tracking-tight">
          Suggest zones
        </h2>
        {km2 != null && <span className={`rounded-full px-3 py-1 text-sm tabular-nums ${tooBig ? 'bg-danger-wash text-danger' : 'bg-canvas text-ink-2'}`}>{km2.toFixed(1)} km² to scan</span>}
        <button type="button" onClick={() => setOpen(false)} className="ml-auto text-sm font-semibold text-ink-3 hover:underline">
          Close
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid gap-2">
          <div className="overflow-hidden rounded-[16px] ring-1 ring-line">
            <ZoneDrawMap value={scan} others={others} onChange={setScan} startKey="suggest" preview={preview} label="Map for drawing the area to suggest zones in" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 text-sm text-ink-3">
              Draw round the whole area (up to {MAX_SCAN_KM2} km²). Existing zones are left out; red only shows where your area crosses one. Suggestions appear in gold (premium), green (standard) and lilac (basic).
            </p>
            {scan && (
              <button type="button" onClick={() => {
                  setScan(null)
                  setResult(null)
                }} className={`${BUTTON_QUIET} min-h-10`}>
                <RotateCcw aria-hidden className="size-4" /> Start again
              </button>
            )}
          </div>
        </div>

        <div className="grid content-start gap-4">
          <div className="fields grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-ink-2">City</span>
              <input value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. Accra" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-2">Zone size</span>
              <select value={size} onChange={(e) => setSize(Number(e.target.value))} className={`${SELECT} mt-1.5 w-full`}>
                {SIZES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-ink-3">Where OpenStreetMap names the neighbourhoods, each gets its own zone and the size is ignored. Otherwise the area is cut into squares of this size.</p>
          {shapeError && scan && <p className="text-sm text-danger">{shapeError}</p>}
          {tooBig && <p className="text-sm text-danger">That area is {km2!.toFixed(0)} km². Scan at most {MAX_SCAN_KM2} km² at a time.</p>}
          <Result msg={error ? { ok: false, text: error } : null} />
          <button type="button" onClick={run} disabled={loading || !scan || !!shapeError || tooBig} className={`${BUTTON_PRIMARY} justify-self-start`}>
            <Sparkles aria-hidden className="size-4" /> {loading ? 'Looking at the area… (this can take up to two minutes)' : result ? 'Suggest again' : 'Suggest zones'}
          </button>

          {result && (
            <div aria-live="polite" className="grid gap-3">
              <p className="text-sm text-ink-2">
                {result.suggestions.length === 0
                  ? 'No suggestions.'
                  : `${result.suggestions.length} ${result.suggestions.length === 1 ? 'suggestion' : 'suggestions'}${result.usedPlaces >= 2 ? `, from ${result.usedPlaces} named places` : ', as a grid (too few named places here)'}. Tiers compare these areas with each other.`}
              </p>
              {result.note && <p className="rounded-[14px] bg-warn-wash p-3 text-sm text-ink">{result.note}</p>}
              <ul className="grid max-h-[480px] gap-2 overflow-y-auto pr-1">
                {result.suggestions
                  .map((s, i) => ({ s, i }))
                  .sort((a, b) => TIER_ORDER[a.s.tier] - TIER_ORDER[b.s.tier] || a.s.name.localeCompare(b.s.name))
                  .map(({ s, i }) => {
                  const done = saved.has(key(i))
                  return (
                    <li key={key(i)} className="rounded-[14px] bg-canvas p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{s.name}</span>
                        <Chip tone={tierTone(s.tier)}>{tierName(s.tier)}</Chip>
                        <span className="text-sm tabular-nums text-ink-3">{s.km2.toFixed(1)} km²</span>
                        {done ? (
                          <span className="ml-auto flex items-center gap-1 text-sm font-semibold text-ok-deep">
                            <CheckCircle2 aria-hidden className="size-4" /> Created
                          </span>
                        ) : (
                          <button type="button" onClick={() => onReview({ key: key(i), name: s.name, city, tier: s.tier, coveredAreas: s.name.startsWith('Area ') ? [] : [s.name], boundary: s.boundary, reasons: s.reasons })} className={`${BUTTON_QUIET} ml-auto min-h-10`}>
                            Review
                          </button>
                        )}
                      </div>
                      {s.reasons.length > 0 && <p className="mt-1 text-sm text-ink-3">{s.reasons.join(' · ')}</p>}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
