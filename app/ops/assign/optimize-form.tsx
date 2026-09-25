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

    const res = await fetch('/api/routes/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: selected, driverId }),
    })

    setLoading(false)
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to optimize route')
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
              disabled={!hasCoords}
            />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 500 }}>{quote.address}</p>
              <p style={{ fontSize: 13, color: '#666' }}>
                GHS {quote.price} — {order.customer.name}
                {!hasCoords && <span style={{ color: '#B3261E' }}> (no coordinates — can't be routed)</span>}
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
          {loading ? 'Optimizing...' : `Optimize & Assign (${selected.length} selected)`}
        </button>
      </div>
    </div>
  )
}