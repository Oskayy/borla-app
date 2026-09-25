'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OptimizeForm({ orders, drivers }: { orders: any[]; drivers: any[] }) {
  const [selected, setSelected] = useState<string[]>([])
  const [driverId, setDriverId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  function toggle(orderId: string) {
    setSelected((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    )
  }

  async function optimizeAndAssign() {
    if (selected.length === 0 || !driverId) {
      setError('Select at least one order and a driver')
      return
    }
    setError('')
    setLoading(true)

    // Split the selection: routable orders go through optimization,
    // no-coordinate orders get manually assigned in selection order.
    const selectedOrders = orders.filter((o) => selected.includes(o.id))
    const routable = selectedOrders.filter((o) => o.latitude != null && o.longitude != null).map((o) => o.id)
    const unroutable = selectedOrders.filter((o) => o.latitude == null || o.longitude == null).map((o) => o.id)

    try {
      if (routable.length > 0) {
        const res = await fetch('/api/routes/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds: routable, driverId }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to optimize route')
        }
      }

      if (unroutable.length > 0) {
        const res = await fetch('/api/orders/manual-assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds: unroutable, driverId }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to manually assign orders')
        }
      }

      setLoading(false)
      router.refresh()
    } catch (e: any) {
      setLoading(false)
      setError(e.message)
    }
  }

  return (
    <div>
      {orders.map((order) => {
        const quote = order.quoteSnapshot as { address?: string; price?: number }
        const hasCoords = order.latitude != null && order.longitude != null
        return (
          <div key={order.id} className="panel" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              checked={selected.includes(order.id)}
              onChange={() => toggle(order.id)}
            />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 500 }}>{quote.address}</p>
              <p style={{ fontSize: 13, color: '#666' }}>
                GHS {quote.price} — {order.customer.name}
                {!hasCoords && (
                  <span style={{ color: '#E8A33D' }}> (no coordinates — will be manually assigned, not routed)</span>
                )}
              </p>
            </div>
          </div>
        )
      })}

      <div className="panel" style={{ marginTop: 16 }}>
        <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="input-field">
          <option value="">Select a driver</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        {error && <p style={{ color: '#B3261E', fontSize: 13, marginBottom: 8 }}>{error}</p>}
        <button onClick={optimizeAndAssign} disabled={loading} className="btn-primary" style={{ width: '100%' }}>
          {loading ? 'Assigning...' : `Optimize & Assign (${selected.length} selected)`}
        </button>
      </div>
    </div>
  )
}