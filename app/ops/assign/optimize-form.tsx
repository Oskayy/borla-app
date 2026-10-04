'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { countDriversInRange, rankDrivers, type DispatchDriver, type DispatchOrder } from '@/lib/dispatch'
import { errorMessage } from '@/lib/errors'

interface OrderRow {
  id: string
  address: string
  price: number | null
  customerName: string
  zoneName: string | null
  latitude: number | null
  longitude: number | null
  litres: number
  litresEstimated: boolean
  shiftDate: string | null
  isLate: boolean
  createdAt: string
}

type DriverRow = Omit<DispatchDriver, 'lastLocationAt'> & { lastLocationAt: string | null }

function waitingFor(iso: string, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins} min`
  if (mins < 60 * 48) return `${Math.floor(mins / 60)} h ${mins % 60} min`
  return `${Math.floor(mins / 1440)} days`
}

function nightLabel(ymd: string | null): string {
  if (!ymd) return 'No night set'
  const [y, m, d] = ymd.split('-').map(Number)
  return 'Night of ' + new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export default function OptimizeForm({
  orders,
  drivers,
  shiftRunning,
  nowIso,
}: {
  orders: OrderRow[]
  drivers: DriverRow[]
  shiftRunning: boolean
  nowIso: string
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [driverId, setDriverId] = useState('')
  const [override, setOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [onlyUnserved, setOnlyUnserved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const now = useMemo(() => new Date(nowIso), [nowIso])

  const dispatchDrivers: DispatchDriver[] = drivers
  const asDispatch = (o: OrderRow): DispatchOrder => ({ id: o.id, latitude: o.latitude, longitude: o.longitude, litres: o.litres })

  // How many drivers could take each order on its own.
  const inRangeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const o of orders) counts[o.id] = countDriversInRange(asDispatch(o), dispatchDrivers, shiftRunning, now)
    return counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, drivers, shiftRunning, now])

  const unservedCount = orders.filter((o) => inRangeCounts[o.id] === 0).length
  const visibleOrders = onlyUnserved ? orders.filter((o) => inRangeCounts[o.id] === 0) : orders

  const selectedOrders = orders.filter((o) => selected.includes(o.id))
  const selectedLitres = selectedOrders.reduce((sum, o) => sum + o.litres, 0)

  const ranked = useMemo(
    () => (selectedOrders.length === 0 ? [] : rankDrivers(dispatchDrivers, selectedOrders.map(asDispatch), shiftRunning, now)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, drivers, shiftRunning, now]
  )
  const chosen = ranked.find((r) => r.driver.id === driverId)
  const needsOverride = !!chosen && !chosen.fit.eligible

  function toggle(orderId: string) {
    setSelected((prev) => (prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]))
    setOverride(false)
  }

  function chooseDriver(id: string) {
    setDriverId(id)
    setOverride(false)
    setError('')
  }

  async function assign() {
    if (selected.length === 0 || !driverId) {
      setError('Select at least one order and a driver')
      return
    }
    if (needsOverride && (!override || overrideReason.trim().length < 3)) {
      setError('This driver fails the checks. Tick "Assign anyway" and give a reason, or choose another driver.')
      return
    }
    setError('')
    setLoading(true)

    const routable = selectedOrders.filter((o) => o.latitude != null && o.longitude != null).map((o) => o.id)
    const unroutable = selectedOrders.filter((o) => o.latitude == null || o.longitude == null).map((o) => o.id)
    const extra = needsOverride ? { override: true, overrideReason } : {}

    try {
      if (routable.length > 0) {
        const res = await fetch('/api/routes/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds: routable, driverId, ...extra }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to assign the route')
        }
      }
      if (unroutable.length > 0) {
        const res = await fetch('/api/orders/manual-assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds: unroutable, driverId, ...extra }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to assign the orders')
        }
      }
      setSelected([])
      setDriverId('')
      setOverride(false)
      setOverrideReason('')
      router.refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {unservedCount > 0 && (
        <div className="panel" style={{ marginBottom: 12, borderLeft: '4px solid #B3261E' }}>
          <p style={{ fontSize: 14 }}>
            <strong>{unservedCount}</strong> paid order(s) have <strong>no driver in range</strong>
            {shiftRunning ? ' among online drivers' : ''}. You can still assign them with an override, give a driver extra
            hours on the Drivers page, or recruit drivers near these areas.
          </p>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <input type="checkbox" checked={onlyUnserved} onChange={(e) => setOnlyUnserved(e.target.checked)} />
            Show only these orders
          </label>
        </div>
      )}

      {visibleOrders.map((order) => {
        const count = inRangeCounts[order.id]
        const hasCoords = order.latitude != null && order.longitude != null
        return (
          <label
            key={order.id}
            className="panel"
            style={{ marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}
          >
            <input type="checkbox" checked={selected.includes(order.id)} onChange={() => toggle(order.id)} style={{ marginTop: 4 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 500 }}>
                {order.address}
                {order.isLate && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#9A6415', background: '#FFF1DC', padding: '1px 6px', borderRadius: 4, marginLeft: 8 }}>
                    LATE
                  </span>
                )}
              </p>
              <p style={{ fontSize: 13, color: '#666' }}>
                {order.price != null && `GHS ${order.price} · `}
                {order.customerName} · {order.litres} L{order.litresEstimated ? ' (estimated)' : ''}
                {order.zoneName && ` · ${order.zoneName}`}
              </p>
              <p style={{ fontSize: 12, color: '#999' }}>
                {nightLabel(order.shiftDate)} · waiting {waitingFor(order.createdAt, now)}
              </p>
              <p style={{ fontSize: 12, marginTop: 2, color: count === 0 ? '#B3261E' : '#2F7A4D' }}>
                {count === 0 ? '⚠ No driver in range' : `${count} driver(s) in range with room`}
                {!hasCoords && <span style={{ color: '#E8A33D' }}> · no coordinates, will be assigned without routing</span>}
              </p>
            </div>
          </label>
        )
      })}

      <div className="panel" style={{ marginTop: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Choose a driver</p>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
          {selectedOrders.length === 0
            ? 'Select orders above to see which drivers can take them.'
            : `${selectedOrders.length} order(s), ${selectedLitres} L. Drivers who pass every check are listed first.`}
        </p>

        {drivers.length === 0 && <p style={{ fontSize: 13, color: '#999' }}>No drivers yet.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {ranked.map(({ driver, fit }) => (
            <label
              key={driver.id}
              className="panel"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                margin: 0,
                cursor: 'pointer',
                opacity: fit.eligible ? 1 : 0.7,
                borderColor: driverId === driver.id ? 'var(--color-accent)' : undefined,
                borderWidth: driverId === driver.id ? 2 : undefined,
              }}
            >
              <input type="radio" name="driver" checked={driverId === driver.id} onChange={() => chooseDriver(driver.id)} style={{ marginTop: 4 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 500, marginBottom: 2 }}>
                  {driver.name}
                  {fit.eligible ? (
                    <span style={{ fontSize: 11, color: '#2F7A4D', fontWeight: 600, marginLeft: 8 }}>✓ CAN TAKE THESE</span>
                  ) : (
                    <span style={{ fontSize: 11, color: '#B3261E', fontWeight: 600, marginLeft: 8 }}>✗ {fit.reasons.join(' · ')}</span>
                  )}
                </p>
                <p style={{ fontSize: 12, color: '#666' }}>
                  {fit.maxDistanceKm != null
                    ? `${fit.maxDistanceKm.toFixed(1)} km from ${fit.position?.source === 'live' ? 'live position' : 'home base'}`
                    : 'Distance unknown'}
                  {driver.radiusKm != null && ` · radius ${driver.radiusKm} km`}
                  {fit.spareLitres != null && ` · ${fit.spareLitres} L free`}
                  {shiftRunning && (driver.available ? ' · online' : ' · offline')}
                </p>
              </div>
            </label>
          ))}
        </div>

        {needsOverride && (
          <div style={{ background: '#FFF6E5', border: '1px solid var(--color-accent)', borderRadius: 4, padding: 10, marginBottom: 12 }}>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
              Assign anyway (the reason is recorded on each order)
            </label>
            {override && (
              <input
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="input-field"
                placeholder="e.g. Driver agreed to go further tonight"
                style={{ marginBottom: 0 }}
              />
            )}
          </div>
        )}

        {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}
        <button onClick={assign} disabled={loading || selected.length === 0 || !driverId} className="btn-primary" style={{ width: '100%' }}>
          {loading ? 'Assigning...' : `Optimize & Assign (${selected.length} selected)`}
        </button>
      </div>
    </div>
  )
}
