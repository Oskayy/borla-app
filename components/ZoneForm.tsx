'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, RotateCcw, Scissors, Users } from 'lucide-react'
import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'
import { CHECK, PANEL, Result, SELECT } from '@/components/ops/kit'
import Skeleton from '@/components/kit/Skeleton'
import { areaKm2, isShapeError, OVERLAP_TOLERANCE_KM2, overlapKm2, parseBoundary, storedBoundary, trimToFit, type ZoneBoundary } from '@/lib/zone-shape'
import type { OtherZone } from '@/components/ops/ZoneDrawMap'

// The map and its drawing tools load only on this page, and only in the browser.
const ZoneDrawMap = dynamic(() => import('@/components/ops/ZoneDrawMap'), { ssr: false, loading: () => <Skeleton className="h-[520px] rounded-none" /> })

export interface ExistingZone {
  id: string
  name: string
  city: string
  coveredAreas: string[]
  active: boolean
  tier: string
  boundary: unknown
}

interface Check {
  state: 'idle' | 'checking' | 'ok' | 'blocked' | 'error'
  text?: string
  overlaps?: { id: string; name: string; km2: number }[]
  moves?: { toThis: number; awayFromThis: number }
  price?: { before: number | null; after: number; followsTier: boolean }
}

// A suggested zone to review ("Suggest zones"): opens the form prefilled, saved like any drawn zone.
export interface ZoneDraft {
  key: string
  name: string
  city: string
  tier: string
  coveredAreas: string[]
  boundary: unknown
  reasons: string[]
}

const TIERS = [
  { value: 'PREMIUM', label: 'Premium' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'BASIC', label: 'Basic' },
]

// Create or change a zone by drawing its outline. Before saving, the server checks the outline (dry run) and says
// whether it overlaps another zone and how many customers would move; saving is blocked while it overlaps.
export default function ZoneForm({
  editingZone,
  draft,
  onDoneEditing,
  onSaved,
  otherZones,
}: {
  editingZone?: ExistingZone | null
  draft?: ZoneDraft | null
  onDoneEditing?: () => void
  onSaved?: () => void
  otherZones: ExistingZone[]
}) {
  const isEditing = !!editingZone
  const start = editingZone ?? draft
  const [name, setName] = useState(start?.name ?? '')
  const [city, setCity] = useState(start?.city ?? '')
  const [coveredAreas, setCoveredAreas] = useState(start?.coveredAreas?.join(', ') ?? '')
  const [tier, setTier] = useState(start?.tier ?? 'STANDARD')
  const [active, setActive] = useState(editingZone?.active ?? true)
  const [boundary, setBoundary] = useState<ZoneBoundary | null>(storedBoundary(start?.boundary))
  const [check, setCheck] = useState<Check>({ state: 'idle' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const others: OtherZone[] = useMemo(
    () => otherZones.filter((z) => z.id !== editingZone?.id).map((z) => ({ id: z.id, name: z.name, active: z.active, boundary: z.boundary })),
    [otherZones, editingZone?.id]
  )
  const shapeProblem = boundary ? parseBoundary(boundary) : null
  const localError = shapeProblem && isShapeError(shapeProblem) ? shapeProblem.error : null
  const km2 = boundary && !localError ? areaKm2(boundary) : null
  // Overlaps worked out in the browser, so the warning shows at once; the server checks again on save.
  const localOverlaps = useMemo(() => {
    if (!boundary || localError || !active) return []
    return others
      .filter((o) => o.active)
      .map((o) => {
        const b = storedBoundary(o.boundary)
        return { name: o.name, km2: b ? overlapKm2(boundary, b) : 0 }
      })
      .filter((o) => o.km2 > OVERLAP_TOLERANCE_KM2)
  }, [boundary, localError, active, others])

  const body = (extra: Record<string, unknown> = {}) =>
    JSON.stringify({ name: name.trim() || 'New zone', city: city.trim() || '-', coveredAreas, tier, active, boundary, ...extra })
  const url = isEditing ? `/api/admin/zones/${editingZone!.id}` : '/api/admin/zones'
  const method = isEditing ? 'PATCH' : 'POST'

  // Ask the server what saving would do, a moment after the outline stops changing.
  useEffect(() => {
    if (!boundary || localError) return
    let stale = false
    const t = window.setTimeout(async () => {
      setCheck({ state: 'checking' })
      try {
        const res = await fetch(`${url}?dryRun=1`, { method, headers: { 'Content-Type': 'application/json' }, body: body() })
        const data = await res.json().catch(() => ({}))
        if (stale) return
        if (res.ok) setCheck({ state: 'ok', moves: data.moves, price: data.price })
        else if (res.status === 409) setCheck({ state: 'blocked', text: data.error, overlaps: data.overlaps, moves: data.moves, price: data.price })
        else setCheck({ state: 'error', text: data.error || 'Could not check the outline' })
      } catch {
        if (!stale) setCheck({ state: 'error', text: 'Could not reach Trashit to check the outline' })
      }
    }, 600)
    return () => {
      stale = true
      window.clearTimeout(t)
    }
    // body() reads the same values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundary, active, localError, tier])

  function trim() {
    if (!boundary) return
    const shapes = others.filter((o) => o.active).map((o) => storedBoundary(o.boundary)).filter((b): b is ZoneBoundary => !!b)
    const t = trimToFit(boundary, shapes)
    if (!t) {
      setError('Nothing is left once the overlap is cut away. Draw the outline again.')
      return
    }
    setError('')
    setBoundary(t)
  }

  async function submit() {
    setError('')
    if (!name.trim() || !city.trim()) return setError('Give the zone a name and a city')
    if (!boundary) return setError('Draw the zone on the map')
    if (localError) return setError(localError)
    setLoading(true)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body({ name: name.trim(), city: city.trim() }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not save the zone')
        if (res.status === 409) setCheck({ state: 'blocked', text: data.error, overlaps: data.overlaps, moves: data.moves })
        return
      }
      onSaved?.()
      if (isEditing || draft) onDoneEditing?.()
      else {
        setName('')
        setCity('')
        setCoveredAreas('')
        setTier('STANDARD')
        setBoundary(null)
        setCheck({ state: 'idle' })
      }
      router.refresh()
    } catch {
      setError('Could not reach Trashit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const [confirmDelete, setConfirmDelete] = useState(false)
  async function handleDelete() {
    if (!editingZone) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/zones/${editingZone.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || 'Could not delete the zone')
      onDoneEditing?.()
      router.refresh()
    } finally {
      setLoading(false)
      setConfirmDelete(false)
    }
  }

  const blocked = check.state === 'blocked' || localOverlaps.length > 0
  const overlapText =
    check.state === 'blocked' && check.text
      ? check.text
      : `This zone overlaps ${localOverlaps.map((o) => `${o.name} (${o.km2.toFixed(2)} km²)`).join(', ')}. Every address must be in one zone only: move its edge, or use Trim to fit.`
  const label = 'text-sm font-medium text-ink-2'
  return (
    <section aria-labelledby="h-zone-form" className={`${PANEL} grid gap-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="h-zone-form" className="text-lg font-semibold tracking-tight">
          {isEditing ? `Edit ${editingZone!.name}` : draft ? `Review suggestion: ${draft.name}` : 'Draw a new zone'}
        </h2>
        {km2 != null && <span className="rounded-full bg-canvas px-3 py-1 text-sm tabular-nums text-ink-2">{km2.toFixed(1)} km² · {boundary!.coordinates[0].length - 1} corners</span>}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid gap-2">
          <div className="overflow-hidden rounded-[16px] ring-1 ring-line">
            <ZoneDrawMap value={boundary} others={others} onChange={setBoundary} startKey={editingZone?.id ?? (draft ? `draft-${draft.key}` : 'new')} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 text-sm text-ink-3">
              {boundary ? 'Drag a white corner to move it; click a small dot between corners to add one.' : 'Click on the map to place each corner. Double-click, or click the first corner, to finish.'}
            </p>
            {boundary && (
              <button type="button" onClick={() => setBoundary(null)} className={`${BUTTON_QUIET} min-h-10`}>
                <RotateCcw aria-hidden className="size-4" /> Start again
              </button>
            )}
          </div>
        </div>

        <div className="grid content-start gap-4">
          {draft && draft.reasons.length > 0 && (
            <div className="rounded-[14px] bg-canvas p-3 text-sm text-ink-2">
              <p className="font-semibold text-ink">Why {draft.tier.charAt(0) + draft.tier.slice(1).toLowerCase()}</p>
              <ul className="mt-1 list-disc pl-5">
                {draft.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-ink-3">A suggestion only: check the outline and the tier against what you know of the area before creating it.</p>
            </div>
          )}
          <label className="block">
            <span className={label}>Zone name</span>
            <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. East Legon" />
          </label>
          <div className="fields grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>City</span>
              <input value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. Accra" />
            </label>
            <label className="block">
              <span className={label}>Tier</span>
              <select value={tier} onChange={(e) => setTier(e.target.value)} className={`${SELECT} mt-1.5 w-full`}>
                {TIERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className={label}>Neighbourhoods covered (comma-separated)</span>
            <input value={coveredAreas} onChange={(e) => setCoveredAreas(e.target.value)} className={`${FIELD} mt-1.5`} placeholder="e.g. East Legon, Adjiringanor" />
          </label>
          {isEditing && (
            <label className="flex min-h-11 items-center gap-2 text-[15px] font-medium">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className={CHECK} />
              Active (customers can book here)
            </label>
          )}
          <p className="text-xs text-ink-3">
            {isEditing
              ? 'If this zone follows its tier’s price, changing the tier changes its price (only a Super Admin can do that here). Finance sets prices on the Pricing page and in the list below.'
              : 'A new zone uses its tier’s price, set by Finance on the Pricing page; Finance can give it its own price later in the list below.'}
          </p>

          {/* What saving would do */}
          <div aria-live="polite" className="grid gap-2">
            {localError && boundary && (
              <p className="flex items-start gap-2 rounded-[14px] bg-danger-wash p-3 text-sm text-danger">
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" /> {localError}
              </p>
            )}
            {!localError && !blocked && check.state === 'checking' && <p className="text-sm text-ink-3">Checking the outline…</p>}
            {!localError && blocked && (
              <div className="grid gap-2 rounded-[14px] bg-danger-wash p-3 text-sm text-danger">
                <p className="flex items-start gap-2">
                  <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" /> {overlapText}
                </p>
                <button type="button" onClick={trim} className={`${BUTTON_QUIET} min-h-10 justify-self-start bg-surface`}>
                  <Scissors aria-hidden className="size-4" /> Trim to fit
                </button>
              </div>
            )}
            {!localError && !blocked && check.state === 'ok' && (
              <p className="flex items-start gap-2 rounded-[14px] bg-ok-wash p-3 text-sm text-ok-deep">
                <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" /> No overlaps. Ready to save.
              </p>
            )}
            {!localError && check.moves && (check.moves.toThis > 0 || check.moves.awayFromThis > 0) && (
              <p className="flex items-start gap-2 rounded-[14px] bg-canvas p-3 text-sm text-ink-2">
                <Users aria-hidden className="mt-0.5 size-4 shrink-0" />
                Saving moves {check.moves.toThis} {check.moves.toThis === 1 ? 'customer' : 'customers'} into this zone
                {check.moves.awayFromThis > 0 && ` and ${check.moves.awayFromThis} out of it`}. Orders already paid keep their price.
              </p>
            )}
            {!localError && check.price && check.state !== 'error' && (check.price.before === null || check.price.before !== check.price.after) && (
              <p className="rounded-[14px] bg-canvas p-3 text-sm text-ink-2">
                {check.price.before === null
                  ? `New bookings here will be priced at ×${check.price.after} (the ${tier.charAt(0) + tier.slice(1).toLowerCase()} tier price).`
                  : `Saving changes this zone’s price from ×${check.price.before} to ×${check.price.after} for new bookings.`}
              </p>
            )}
            {check.state === 'error' && <p className="text-sm text-danger">{check.text}</p>}
          </div>

          <Result msg={error ? { ok: false, text: error } : null} />
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={submit} disabled={loading || blocked || !!localError || !boundary} className={BUTTON_PRIMARY}>
              {loading ? 'Saving…' : isEditing ? 'Save changes' : 'Create zone'}
            </button>
            {(isEditing || draft) && (
              <button type="button" onClick={onDoneEditing} disabled={loading} className={BUTTON_QUIET}>
                {draft ? 'Back to suggestions' : 'Cancel'}
              </button>
            )}
          </div>
          {isEditing &&
            (confirmDelete ? (
              <div className="grid gap-2 rounded-[14px] bg-danger-wash p-3 text-sm">
                <p>Delete &ldquo;{editingZone!.name}&rdquo;? This can&apos;t be undone. Zones with customers, drivers, sites or orders can only be switched off.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={handleDelete} disabled={loading} className={BUTTON_DANGER}>
                    Delete zone
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className={BUTTON_QUIET}>
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} disabled={loading} className="justify-self-start text-sm font-semibold text-danger hover:underline">
                Delete this zone
              </button>
            ))}
        </div>
      </div>
    </section>
  )
}
