'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { countDriversInRange, rankDrivers, type DispatchDriver, type DispatchOrder } from '@/lib/dispatch'
import { errorMessage } from '@/lib/errors'
import { AlertTriangle } from 'lucide-react'
import { BUTTON_PRIMARY, FIELD } from '@/components/ui'

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
    <div className="grid gap-4">
      {unservedCount > 0 && (
        <div className="rounded-card bg-danger-wash p-4 sm:px-5">
          <p className="flex items-start gap-2 text-[15px] text-ink">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
            <span>
              <strong className="font-semibold">
                {unservedCount} paid {unservedCount === 1 ? 'order has' : 'orders have'} no driver in range
              </strong>
              {shiftRunning ? ' among online drivers' : ''}. You can still assign with an override, give a driver extra hours on the Drivers
              page, or recruit drivers near these areas.
            </span>
          </p>
          <label className="mt-2 flex min-h-10 items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={onlyUnserved} onChange={(e) => setOnlyUnserved(e.target.checked)} className="size-4 accent-[var(--color-ops)]" />
            Show only these orders
          </label>
        </div>
      )}

      <fieldset>
        <legend className="text-sm font-semibold text-ink-2">1. Choose orders</legend>
        <ul className="mt-2 divide-y divide-line rounded-card bg-surface ring-1 ring-line">
          {visibleOrders.map((order) => {
            const count = inRangeCounts[order.id]
            const hasCoords = order.latitude != null && order.longitude != null
            const on = selected.includes(order.id)
            return (
              <li key={order.id}>
                <label className={`flex cursor-pointer items-start gap-3 p-4 transition sm:px-5 ${on ? 'bg-ops-wash/60' : 'hover:bg-canvas'}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(order.id)} className="mt-1 size-4 shrink-0 accent-[var(--color-ops)]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {order.address}
                      {order.isLate && <span className="rounded-full bg-driver-wash px-2 py-0.5 text-xs font-semibold text-driver-deep">Late booking</span>}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-2">
                      {order.price != null && <span className="tabular-nums">GHS {order.price.toFixed(2)} · </span>}
                      {order.customerName} · {order.litres} L{order.litresEstimated ? ' (estimated)' : ''}
                      {order.zoneName && ` · ${order.zoneName}`}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-3">
                      {nightLabel(order.shiftDate)} · waiting {waitingFor(order.createdAt, now)}
                    </span>
                    <span className={`mt-1 block text-sm font-medium ${count === 0 ? 'text-danger' : 'text-ink-2'}`}>
                      {count === 0 ? 'No driver in range' : `${count} ${count === 1 ? 'driver' : 'drivers'} in range with room`}
                      {!hasCoords && <span className="font-normal text-driver-deep"> · no map pin, will be assigned without routing</span>}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <fieldset className="rounded-card bg-surface p-5 ring-1 ring-line sm:p-6">
        <legend className="sr-only">2. Choose a driver</legend>
        <p className="text-sm font-semibold text-ink-2" aria-hidden>
          2. Choose a driver
        </p>
        <p className="mt-0.5 text-sm text-ink-3">
          {selectedOrders.length === 0
            ? 'Select orders above to see which drivers can take them.'
            : `${selectedOrders.length} ${selectedOrders.length === 1 ? 'order' : 'orders'}, ${selectedLitres} L. Drivers who pass every check are listed first.`}
        </p>

        {drivers.length === 0 && <p className="mt-3 text-[15px] text-ink-3">No drivers yet.</p>}

        <div className="mt-3 grid gap-2">
          {ranked.map(({ driver, fit }) => {
            const on = driverId === driver.id
            return (
              <label
                key={driver.id}
                className={`flex cursor-pointer items-start gap-3 rounded-control p-3.5 ring-1 transition ${
                  on ? 'bg-ops-wash/60 ring-2 ring-ops' : 'ring-line hover:bg-canvas'
                }`}
              >
                <input type="radio" name="driver" checked={on} onChange={() => chooseDriver(driver.id)} className="mt-1 size-4 shrink-0 accent-[var(--color-ops)]" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {driver.name}
                    {fit.eligible ? (
                      <span className="rounded-full bg-ops-wash px-2 py-0.5 text-xs font-semibold text-ops-deep">Can take these</span>
                    ) : (
                      <span className="text-sm font-normal text-danger">{fit.reasons.join(' · ')}</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-ink-3">
                    {fit.maxDistanceKm != null
                      ? `${fit.maxDistanceKm.toFixed(1)} km from ${fit.position?.source === 'live' ? 'live position' : 'home base'}`
                      : 'Distance unknown'}
                    {driver.radiusKm != null && ` · radius ${driver.radiusKm} km`}
                    {fit.spareLitres != null && ` · ${fit.spareLitres} L free`}
                    {shiftRunning && (driver.available ? ' · online' : ' · offline')}
                  </span>
                </span>
              </label>
            )
          })}
        </div>

        {needsOverride && (
          <div className="mt-4 rounded-control bg-danger-wash p-3.5">
            <label className="flex min-h-10 items-center gap-2 text-[15px] font-medium">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="size-4 accent-[var(--color-ops)]" />
              Assign anyway (the reason is recorded on each order)
            </label>
            {override && (
              <label className="mt-2 block">
                <span className="sr-only">Reason</span>
                <input
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className={FIELD}
                  placeholder="e.g. Driver agreed to go further tonight"
                />
              </label>
            )}
          </div>
        )}

        <p aria-live="polite" className="mt-3 text-sm text-danger empty:hidden">
          {error}
        </p>
        <button type="button" onClick={assign} disabled={loading || selected.length === 0 || !driverId} className={`${BUTTON_PRIMARY} mt-4 w-full`}>
          {loading ? 'Assigning…' : `Route and assign (${selected.length} selected)`}
        </button>
      </fieldset>
    </div>
  )
}
