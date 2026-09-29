'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { proposePlan, buildDriverPlan, type PlanOrder, type PlanSite } from '@/lib/planner'
import { assessDriver, nightCapacity, type DispatchDriver } from '@/lib/dispatch'

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
}: {
  orders: PlanOrderRow[]
  drivers: DriverRow[]
  sites: PlanSite[]
  shiftRunning: boolean
  nowIso: string
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
  // After an approval the page reloads with fewer orders: start again from the new suggestion.
  useEffect(() => {
    setAssignment(suggestedMap)
    setSiteChoices({})
  }, [suggestedMap])
  const [reasons, setReasons] = useState<Record<string, string>>({})
  // Sites ops picked by hand: { driverId: { tripNumber: siteId } }
  const [siteChoices, setSiteChoices] = useState<Record<string, Record<string, string>>>({})
  const siteById = useMemo(() => Object.fromEntries(sites.map((st) => [st.id, st])), [sites])
  const [busy, setBusy] = useState(false)
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
      .map((d) => ({ d, ok: assessDriver(d, [o], shiftRunning, now).eligible }))
      .sort((a, b) => Number(b.ok) - Number(a.ok) || a.d.name.localeCompare(b.d.name))
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
        (data.results ?? []).map((r: any) => ({
          ok: r.ok,
          text: `${driverById[r.driverId]?.name ?? 'Driver'}: ${r.ok ? `approved, ${r.stops} stop(s) in ${r.trips} trip(s)` : r.message}`,
        }))
      )
      router.refresh()
    } catch {
      setMessages([{ ok: false, text: 'Could not reach Borla. Please try again.' }])
    } finally {
      setBusy(false)
    }
  }

  const selectStyle = { fontSize: 12, padding: '3px 4px', border: '1px solid var(--color-border)', borderRadius: 4, maxWidth: 180 } as const

  function MoveSelect({ o }: { o: PlanOrderRow }) {
    return (
      <select value={assignment[o.id]} onChange={(e) => move(o.id, e.target.value)} style={selectStyle} aria-label="Move this order">
        <option value={UNASSIGNED}>Leave unassigned</option>
        {driverOptions(o).map(({ d, ok }) => (
          <option key={d.id} value={d.id}>
            {ok ? '✓ ' : '✗ '}
            {d.name}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontWeight: 600 }}>Suggested plan</p>
          <p style={{ fontSize: 13, color: '#666' }}>
            {orders.length - unassignedOrders.length} of {orders.length} order(s) planned across {plans.length} driver(s)
            {unassignedOrders.length > 0 && ` · ${unassignedOrders.length} not assigned`}
            {edited && ' · edited by you'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {edited && (
            <button
              onClick={() => {
                setAssignment(suggestedMap)
                setMessages([])
              }}
              disabled={busy}
              style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '8px 12px', fontSize: 13 }}
            >
              Reset to suggestion
            </button>
          )}
          <button onClick={() => approve(cleanPlans.map((p) => p.driverId))} disabled={busy || cleanPlans.length === 0} className="btn-accent">
            {busy ? 'Approving...' : `Approve all (${cleanPlans.length})`}
          </button>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          {messages.map((m, i) => (
            <p key={i} style={{ fontSize: 13, color: m.ok ? '#2F7A4D' : '#B3261E' }}>
              {m.ok ? '✓ ' : '✗ '}
              {m.text}
            </p>
          ))}
        </div>
      )}

      {plans.map((p) => {
        const d = driverById[p.driverId]
        const cap = nightCapacity(d)
        const hasProblems = p.problems.length > 0
        return (
          <div key={p.driverId} className="panel" style={{ marginBottom: 12, borderLeft: `4px solid ${hasProblems ? '#B3261E' : 'var(--color-success)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontWeight: 600 }}>{d.name}</p>
                <p style={{ fontSize: 12, color: '#666' }}>
                  {d.vehicleName ?? 'Vehicle'} · {p.orderIds.length} stop(s) · {p.trips.length} trip(s) · {p.litres} L
                  {d.loadLitres > 0 && ` (+${d.loadLitres} L already assigned)`} of {cap} L tonight · ~{p.distanceKm} km
                  {shiftRunning && (d.available ? ' · online' : ' · offline')}
                </p>
                {hasProblems && <p style={{ fontSize: 12, color: '#B3261E', marginTop: 2 }}>✗ {p.problems.join(' · ')}</p>}
              </div>
              <button onClick={() => approve([p.driverId])} disabled={busy || (hasProblems && (reasons[p.driverId] ?? '').trim().length < 3)} className="btn-primary">
                Approve
              </button>
            </div>

            {hasProblems && (
              <input
                value={reasons[p.driverId] ?? ''}
                onChange={(e) => setReasons((r) => ({ ...r, [p.driverId]: e.target.value }))}
                className="input-field"
                placeholder="Reason for approving anyway (recorded on each order)"
                style={{ marginTop: 8, marginBottom: 0 }}
              />
            )}

            {p.trips.map((t) => (
              <div key={t.tripNumber} style={{ marginTop: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)' }}>
                  Trip {t.tripNumber} · {t.litres} L
                </p>
                {t.orderIds.map((id, i) => {
                  const o = orderById[id]
                  return (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid #eee' }}>
                      <span style={{ fontSize: 13 }}>
                        {i + 1}. {o.address}{' '}
                        <span style={{ color: '#999' }}>
                          · {o.litres} L{o.litresEstimated ? '*' : ''}
                          {o.isLate ? ' · LATE' : ''}
                        </span>
                        {(o.rolloverCount ?? 0) > 0 && (
                          <span style={{ color: '#B3261E', fontSize: 12, fontWeight: 600 }}> · MISSED {o.rolloverCount}× BEFORE</span>
                        )}
                        {o.declinedBy?.includes(p.driverId) && (
                          <span style={{ color: '#B3261E', fontSize: 12 }}> · this driver declined it</span>
                        )}
                      </span>
                      <MoveSelect o={o} />
                    </div>
                  )
                })}
                {(() => {
                  const chosen = siteChoices[p.driverId]?.[String(t.tripNumber)] ?? t.siteId ?? ''
                  const chosenSite = chosen ? siteById[chosen] : null
                  const warning = chosenSite ? (chosenSite.usable ? null : 'This site is closed or full tonight') : t.siteProblem
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                      <span style={{ fontSize: 13 }}>
                        🏁 Unload at <strong>{chosenSite?.name ?? 'no site chosen'}</strong>
                        {warning && <span style={{ color: '#B3261E', fontSize: 12 }}> · ⚠ {warning}</span>}
                      </span>
                      <select
                        value={chosen}
                        onChange={(e) =>
                          setSiteChoices((c) => ({ ...c, [p.driverId]: { ...(c[p.driverId] ?? {}), [String(t.tripNumber)]: e.target.value } }))
                        }
                        style={selectStyle}
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
                    </div>
                  )
                })()}
              </div>
            ))}
          </div>
        )
      })}

      {unassignedOrders.length > 0 && (
        <div className="panel" style={{ marginBottom: 12, borderLeft: '4px solid #999' }}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>Not assigned ({unassignedOrders.length})</p>
          {unassignedOrders.map((o) => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid #eee' }}>
              <span style={{ fontSize: 13 }}>
                {o.address} <span style={{ color: '#999' }}>· {o.litres} L</span>
                <br />
                <span style={{ fontSize: 12, color: '#B3261E' }}>
                  {suggestedMap[o.id] === UNASSIGNED ? suggestedReason[o.id] : 'Left out by you'}
                </span>
              </span>
              <MoveSelect o={o} />
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, color: '#999' }}>
        ✓ = the driver could take that order on its own. Moving orders re-checks radius, capacity and online status; a driver
        card turns red if their plan breaks a rule. * = size estimated from an older order.
      </p>
    </div>
  )
}
