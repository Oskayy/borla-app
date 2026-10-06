'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { proposePlan, buildDriverPlan, type PlanOrder, type PlanSite } from '@/lib/planner'
import dynamic from 'next/dynamic'
import { assessDriver, driverPosition, nightCapacity, type DispatchDriver } from '@/lib/dispatch'
import type { MapRoute } from '@/components/ops/AssignMap'
import { AlertTriangle, CheckCircle2, Flag, Map as MapIcon, RotateCcw, XCircle } from 'lucide-react'
import { BUTTON_PRIMARY, BUTTON_QUIET, FIELD } from '@/components/ui'

// The map only loads in the browser, after the rest of the board (it's the heaviest part of the page).
const AssignMap = dynamic(() => import('@/components/ops/AssignMap'), {
  ssr: false,
  loading: () => <div className="h-full min-h-[420px] animate-pulse rounded-card bg-line/60" />,
})

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

export interface PlanOrderRow extends PlanOrder {
  address: string
  customerName: string
  isLate: boolean
  litresEstimated: boolean
  rolloverCount?: number // nights this order has been moved on already
}

type DriverRow = Omit<DispatchDriver, 'lastLocationAt'> & { lastLocationAt: string | null }

const UNASSIGNED = ''

export default function PlanBoard({
  orders,
  drivers,
  sites,
  shiftRunning,
  nowIso,
  assigned = [],
}: {
  orders: PlanOrderRow[]
  drivers: DriverRow[]
  sites: PlanSite[]
  shiftRunning: boolean
  nowIso: string
  assigned?: MapRoute[] // routes already given to drivers tonight (drawn solid)
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso])
  const router = useRouter()

  // The system's suggestion, worked out once when the page loads.
  const suggestion = useMemo(() => proposePlan(drivers, orders, shiftRunning, now, sites), [drivers, orders, shiftRunning, now, sites])
  const suggestedMap = useMemo(() => {
    const m: Record<string, string> = {}
    orders.forEach((o) => (m[o.id] = UNASSIGNED))
    suggestion.drivers.forEach((p) => p.orderIds.forEach((id) => (m[id] = p.driverId)))
    return m
  }, [suggestion, orders])
  const suggestedReason = useMemo(() => {
    const m: Record<string, string> = {}
    suggestion.unassigned.forEach((u) => (m[u.orderId] = u.reason))
    return m
  }, [suggestion])

  // orderId -> driverId ('' = unassigned). Starts as the suggestion; edits change it.
  const [assignment, setAssignment] = useState<Record<string, string>>(suggestedMap)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  // Sites ops picked by hand: { driverId: { tripNumber: siteId } }
  const [siteChoices, setSiteChoices] = useState<Record<string, Record<string, string>>>({})
  // After an approval the page reloads with fewer orders: start again from the new suggestion.
  const [planBasis, setPlanBasis] = useState(suggestedMap)
  if (planBasis !== suggestedMap) {
    setPlanBasis(suggestedMap)
    setAssignment(suggestedMap)
    setSiteChoices({})
  }
  const siteById = useMemo(() => Object.fromEntries(sites.map((st) => [st.id, st])), [sites])
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<string | null>(null) // driver whose route the map highlights
  const [allDriversFor, setAllDriversFor] = useState<Set<string>>(new Set()) // orders whose Move list shows every driver
  const [phoneView, setPhoneView] = useState<'list' | 'map'>('list') // phones show one at a time
  const [messages, setMessages] = useState<{ ok: boolean; text: string }[]>([])

  const orderById = useMemo(() => Object.fromEntries(orders.map((o) => [o.id, o])), [orders])
  const driverById = useMemo(() => Object.fromEntries(drivers.map((d) => [d.id, d])), [drivers])
  const edited = orders.some((o) => assignment[o.id] !== suggestedMap[o.id])

  // Rebuild each driver's plan from the current assignment, flagging rule breaks.
  const plans = useMemo(() => {
    const groups: Record<string, PlanOrderRow[]> = {}
    for (const o of orders) {
      const d = assignment[o.id]
      if (d) (groups[d] ??= []).push(o)
    }
    return Object.entries(groups)
      .filter(([id]) => driverById[id])
      .map(([id, os]) => buildDriverPlan(driverById[id], os, shiftRunning, now, sites))
      .sort((a, b) => b.orderIds.length - a.orderIds.length)
  }, [assignment, orders, driverById, shiftRunning, now, sites])

  const unassignedOrders = orders.filter((o) => !assignment[o.id])
  const cleanPlans = plans.filter((p) => p.problems.length === 0 || (reasons[p.driverId] ?? '').trim().length >= 3)

  // Drivers offered in the "move to" menu for an order: ones who could take it on its own come first.
  function driverOptions(o: PlanOrderRow) {
    return drivers
      .map((d) => {
        const fit = assessDriver(d, [o], shiftRunning, now)
        return { d, ok: fit.eligible, km: fit.maxDistanceKm ?? Infinity, why: fit.reasons[0] ?? '' }
      })
      .sort((a, b) => Number(b.ok) - Number(a.ok) || a.km - b.km || a.d.name.localeCompare(b.d.name))
  }

  function move(orderId: string, driverId: string) {
    setAssignment((a) => ({ ...a, [orderId]: driverId }))
    setMessages([])
  }

  async function approve(driverIds: string[]) {
    const toSend = plans
      .filter((p) => driverIds.includes(p.driverId))
      .map((p) => ({
        driverId: p.driverId,
        orderIds: p.orderIds,
        siteChoices: siteChoices[p.driverId] ?? {},
        ...(p.problems.length > 0 ? { override: true, overrideReason: reasons[p.driverId] ?? '' } : {}),
      }))
    if (toSend.length === 0) return
    setBusy(true)
    setMessages([])
    try {
      const res = await fetch('/api/admin/plan/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans: toSend }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessages([{ ok: false, text: data.error || 'Could not approve' }])
        return
      }
      setMessages(
        (data.results ?? []).map((r: { driverId: string; ok: boolean; stops?: number; trips?: number; message?: string }) => ({
          ok: r.ok,
          text: `${driverById[r.driverId]?.name ?? 'Driver'}: ${
            r.ok ? `approved, ${r.stops} ${r.stops === 1 ? 'stop' : 'stops'} in ${r.trips} ${r.trips === 1 ? 'trip' : 'trips'}` : r.message
          }`,
        }))
      )
      router.refresh()
    } catch {
      setMessages([{ ok: false, text: 'Could not reach Trashit. Please try again.' }])
    } finally {
      setBusy(false)
    }
  }

  const selectCls =
    'min-h-10 max-w-[13rem] rounded-control border border-line-strong bg-surface px-2.5 text-sm text-ink focus:border-action focus:outline-none focus:ring-3 focus:ring-action/20'

  function MoveSelect({ o }: { o: PlanOrderRow }) {
    const options = driverOptions(o)
    const all = allDriversFor.has(o.id)
    const current = assignment[o.id]
    const good = options.filter((x) => x.ok)
    const shownGood = all ? good : good.filter((x, i) => i < 3 || x.d.id === current)
    const shownBad = all ? options.filter((x) => !x.ok) : options.filter((x) => !x.ok && x.d.id === current)
    const hidden = options.length - shownGood.length - shownBad.length
    return (
      <select
        value={current}
        onChange={(e) => {
          if (e.target.value === '__all__') setAllDriversFor((s) => new Set(s).add(o.id))
          else move(o.id, e.target.value)
        }}
        className={selectCls}
        aria-label={`Move ${o.address}`}
      >
        <option value={UNASSIGNED}>Leave unassigned</option>
        {shownGood.length > 0 && (
          <optgroup label={all ? 'Can take it' : 'Nearest who can take it'}>
            {shownGood.map(({ d, km }) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {Number.isFinite(km) ? ` · ${km.toFixed(1)} km` : ''}
              </option>
            ))}
          </optgroup>
        )}
        {shownBad.length > 0 && (
          <optgroup label="Would break a rule">
            {shownBad.map(({ d, why }) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {why ? ` (${why})` : ''}
              </option>
            ))}
          </optgroup>
        )}
        {!all && hidden > 0 && <option value="__all__">Show all drivers ({hidden} more)…</option>}
      </select>
    )
  }

  function OrderTags({ o, driverId }: { o: PlanOrderRow; driverId?: string }) {
    return (
      <>
        <span className="tabular-nums text-ink-3">
          {o.litres} L{o.litresEstimated ? ' (estimated)' : ''}
        </span>
        {o.isLate && <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold text-ink-2 ring-1 ring-line">Late booking</span>}
        {(o.rolloverCount ?? 0) > 0 && (
          <span className="rounded-full bg-danger-wash px-2 py-0.5 text-xs font-semibold text-danger">
            Missed {o.rolloverCount}× before
          </span>
        )}
        {driverId && o.declinedBy?.includes(driverId) && (
          <span className="rounded-full bg-danger-wash px-2 py-0.5 text-xs font-semibold text-danger">This driver declined it</span>
        )}
      </>
    )
  }

  // Each driver's route for the map: start, then each trip's stops in order, then that trip's disposal site.
  const mapRoutes: MapRoute[] = plans.map((p) => {
    const d = driverById[p.driverId]
    const pos = driverPosition(d as unknown as DispatchDriver, shiftRunning, now)
    const points: MapRoute['points'] = []
    for (const t of p.trips) {
      for (const id of t.orderIds) {
        const o = orderById[id]
        if (o?.latitude != null && o.longitude != null) points.push({ kind: 'stop', lat: o.latitude, lng: o.longitude, label: o.address })
      }
      const siteId = siteChoices[p.driverId]?.[String(t.tripNumber)] ?? t.siteId
      const site = siteId ? siteById[siteId] : null
      if (site) points.push({ kind: 'site', lat: site.lat, lng: site.lng, label: site.name })
    }
    return { driverId: p.driverId, name: d.name, initials: initialsOf(d.name), start: pos ? { lat: pos.lat, lng: pos.lng } : null, points, problem: p.problems.length > 0, planned: true }
  })
  const mapUnassigned = unassignedOrders
    .filter((o) => o.latitude != null && o.longitude != null)
    .map((o) => ({ lat: o.latitude as number, lng: o.longitude as number, label: o.address }))
  const tripCount = plans.reduce((n, p) => n + p.trips.length, 0)
  const freeLitres = drivers
    .filter((d) => assessDriver(d as unknown as DispatchDriver, [], shiftRunning, now).counts)
    .reduce((n, d) => n + Math.max(0, nightCapacity(d as unknown as DispatchDriver) - d.loadLitres), 0)
  const plannedLitres = plans.reduce((n, p) => n + p.litres, 0)
  const conflicts = plans.filter((p) => p.problems.length > 0).length
  const kpis = [
    { label: 'Unassigned orders', value: String(unassignedOrders.length), tone: unassignedOrders.length ? 'text-danger' : '' },
    { label: 'Suggested trips', value: String(tripCount), tone: '' },
    { label: 'Free capacity tonight', value: `${Math.max(0, freeLitres - plannedLitres).toLocaleString()} L`, tone: '' },
    { label: 'Rule conflicts', value: String(conflicts), tone: conflicts ? 'text-danger' : '' },
  ]

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-3.5 ring-1 ring-line">
            <dt className="text-sm text-ink-2">{k.label}</dt>
            <dd className={`text-xl font-bold tabular-nums tracking-tight ${k.tone}`}>{k.value}</dd>
          </div>
        ))}
      </dl>
      <div className="sticky top-[4.5rem] z-10 flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-line sm:px-5">
        <div>
          <p className="font-semibold">Suggested plan</p>
          <p className="text-sm text-ink-3">
            {orders.length - unassignedOrders.length} of {orders.length} planned across {plans.length} {plans.length === 1 ? 'driver' : 'drivers'}
            {unassignedOrders.length > 0 && ` · ${unassignedOrders.length} not assigned`}
            {edited && ' · edited by you'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {edited && (
            <button
              type="button"
              onClick={() => {
                setAssignment(suggestedMap)
                setMessages([])
              }}
              disabled={busy}
              className={BUTTON_QUIET}
            >
              <RotateCcw aria-hidden className="size-4" /> Reset to suggestion
            </button>
          )}
          <button type="button" onClick={() => approve(cleanPlans.map((p) => p.driverId))} disabled={busy || cleanPlans.length === 0} className={BUTTON_PRIMARY}>
            {busy ? 'Approving…' : `Approve all (${cleanPlans.length})`}
          </button>
        </div>
      </div>

      {messages.length > 0 && (
        <ul aria-live="polite" className="grid gap-1.5 rounded-card bg-surface p-4 ring-1 ring-line">
          {messages.map((m, i) => (
            <li key={i} className={`flex items-start gap-2 text-sm ${m.ok ? 'text-ink' : 'text-danger'}`}>
              {m.ok ? <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-ops" /> : <XCircle aria-hidden className="mt-0.5 size-4 shrink-0" />}
              {m.text}
            </li>
          ))}
        </ul>
      )}

      <div role="tablist" aria-label="View" className="grid grid-cols-2 gap-1 rounded-control bg-canvas p-1 ring-1 ring-line lg:hidden">
        {(['list', 'map'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={phoneView === v}
            onClick={() => setPhoneView(v)}
            className={`min-h-10 rounded-[8px] text-sm font-semibold transition ${phoneView === v ? 'bg-surface text-ink shadow-card' : 'text-ink-3'}`}
          >
            {v === 'list' ? 'Drivers and stops' : 'Map'}
          </button>
        ))}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className={`grid gap-4 ${phoneView === 'map' ? 'hidden lg:grid' : ''}`}>
      {plans.map((p) => {
        const d = driverById[p.driverId]
        const cap = nightCapacity(d)
        const used = p.litres + d.loadLitres
        const hasProblems = p.problems.length > 0
        return (
          <section
            key={p.driverId}
            aria-label={d.name}
            className={`rounded-card bg-surface p-5 transition sm:p-6 ${
              selected === p.driverId ? 'ring-2 ring-driver' : hasProblems ? 'ring-1 ring-danger/40' : 'ring-1 ring-line hover:ring-line-strong'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 basis-72">
                <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
                  {d.name}
                  <button
                    type="button"
                    aria-pressed={selected === p.driverId}
                    onClick={() => {
                      setSelected(selected === p.driverId ? null : p.driverId)
                      setPhoneView('map')
                    }}
                    className={`press inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 transition ${
                      selected === p.driverId ? 'bg-driver text-night ring-driver' : 'text-ink-2 ring-line-strong hover:bg-canvas'
                    }`}
                  >
                    <MapIcon aria-hidden className="size-3.5" /> {selected === p.driverId ? 'On the map' : 'Show on map'}
                  </button>
                  {shiftRunning && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.available ? 'bg-driver-wash text-driver-deep' : 'bg-canvas text-ink-3 ring-1 ring-line'}`}
                    >
                      {d.available ? 'Online' : 'Offline'}
                    </span>
                  )}
                </h3>
                <p className="mt-0.5 text-sm text-ink-3">
                  {d.vehicleName ?? 'Vehicle'} · {p.orderIds.length} {p.orderIds.length === 1 ? 'stop' : 'stops'} · {p.trips.length}{' '}
                  {p.trips.length === 1 ? 'trip' : 'trips'} · about {p.distanceKm} km
                </p>
                <div className="mt-3 max-w-md">
                  <div className="flex justify-between text-xs text-ink-3">
                    <span>
                      Load tonight{d.loadLitres > 0 && ` (incl. ${d.loadLitres} L already assigned)`}
                    </span>
                    <span className="tabular-nums">
                      {used} / {cap} L
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
                    <span
                      className={`block h-full rounded-full ${used > cap ? 'bg-danger' : 'bg-driver'}`}
                      style={{ width: `${Math.min(100, cap ? (used / cap) * 100 : 0)}%` }}
                    />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => approve([p.driverId])}
                disabled={busy || (hasProblems && (reasons[p.driverId] ?? '').trim().length < 3)}
                className={hasProblems ? BUTTON_QUIET : BUTTON_PRIMARY}
              >
                {hasProblems ? 'Approve anyway' : 'Approve'}
              </button>
            </div>

            {hasProblems && (
              <div className="mt-4 rounded-control bg-danger-wash p-3.5">
                <p className="flex items-start gap-2 text-sm text-ink">
                  <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
                  <span>{p.problems.join(' · ')}</span>
                </p>
                <label className="mt-2.5 block">
                  <span className="text-sm font-medium text-ink-2">Reason for approving anyway (recorded on each order)</span>
                  <input
                    value={reasons[p.driverId] ?? ''}
                    onChange={(e) => setReasons((r) => ({ ...r, [p.driverId]: e.target.value }))}
                    className={`${FIELD} mt-1.5`}
                    placeholder="e.g. Driver agreed to go further tonight"
                  />
                </label>
              </div>
            )}

            {p.trips.map((t) => {
              const chosen = siteChoices[p.driverId]?.[String(t.tripNumber)] ?? t.siteId ?? ''
              const chosenSite = chosen ? siteById[chosen] : null
              const warning = chosenSite ? (chosenSite.usable ? null : 'This site is closed or full tonight') : t.siteProblem
              return (
                <div key={t.tripNumber} className="mt-5">
                  <p className="text-sm font-semibold text-ink-2">
                    Trip {t.tripNumber} <span className="font-normal tabular-nums text-ink-3">· {t.litres} L</span>
                  </p>
                  <ol className="mt-1.5 divide-y divide-line border-y border-line">
                    {t.orderIds.map((id, i) => {
                      const o = orderById[id]
                      return (
                        <li key={id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2.5">
                          <span className="flex min-w-0 flex-1 basis-64 items-start gap-3">
                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-customer text-xs font-semibold tabular-nums text-white">
                              {i + 1}
                            </span>
                            <span className="min-w-0 text-[15px]">
                              <span className="block">{o.address}</span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm">
                                <OrderTags o={o} driverId={p.driverId} />
                              </span>
                            </span>
                          </span>
                          <MoveSelect o={o} />
                        </li>
                      )
                    })}
                    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2.5">
                      <span className="flex min-w-0 flex-1 basis-64 items-start gap-3">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ops-wash text-ops-deep">
                          <Flag aria-hidden className="size-3.5" />
                        </span>
                        <span className="min-w-0 text-[15px]">
                          Unload at <strong className="font-semibold">{chosenSite?.name ?? 'no site chosen'}</strong>
                          {warning && <span className="mt-0.5 block text-sm text-danger">{warning}</span>}
                        </span>
                      </span>
                      <select
                        value={chosen}
                        onChange={(e) => setSiteChoices((c) => ({ ...c, [p.driverId]: { ...(c[p.driverId] ?? {}), [String(t.tripNumber)]: e.target.value } }))}
                        className={selectCls}
                        aria-label={`Disposal site for trip ${t.tripNumber}`}
                      >
                        <option value="">No site</option>
                        {[...sites]
                          .sort((a, b) => Number(b.usable) - Number(a.usable))
                          .map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.usable ? '' : '(closed) '}
                              {st.name}
                            </option>
                          ))}
                      </select>
                    </li>
                  </ol>
                </div>
              )
            })}
          </section>
        )
      })}

      {unassignedOrders.length > 0 && (
        <section aria-labelledby="unassigned" className="rounded-card bg-surface p-5 ring-1 ring-line sm:p-6">
          <h3 id="unassigned" className="text-lg font-semibold tracking-tight">
            Not assigned <span className="font-normal tabular-nums text-ink-3">({unassignedOrders.length})</span>
          </h3>
          <ul className="mt-2 divide-y divide-line">
            {unassignedOrders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2.5">
                <span className="min-w-0 flex-1 basis-64 text-[15px]">
                  <span className="block">{o.address}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm">
                    <OrderTags o={o} />
                  </span>
                  <span className="mt-0.5 block text-sm text-danger">{suggestedMap[o.id] === UNASSIGNED ? suggestedReason[o.id] : 'Left out by you'}</span>
                </span>
                <MoveSelect o={o} />
              </li>
            ))}
          </ul>
        </section>
      )}

      </div>
      <div className={`h-[70vh] lg:sticky lg:top-24 lg:block lg:h-[calc(100dvh-8rem)] ${phoneView === 'list' ? 'hidden' : ''}`}>
        <AssignMap routes={[...assigned, ...mapRoutes]} unassigned={mapUnassigned} selected={selected} onSelect={setSelected} />
      </div>
      </div>

      <p className="text-sm text-ink-3">
        Tap a driver to see their route on the map. In each “Move” list, drivers under “Can take it” could take that order on its own. Moving orders re-checks radius, capacity and
        online status; a driver’s card turns red if their plan breaks a rule.
      </p>
    </div>
  )
}
