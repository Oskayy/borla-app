'use client'

import { useState } from 'react'

export default function AssignForm({ order, drivers }: {
  order: { id: string; quoteSnapshot: unknown; customer: { name: string } }
  drivers: { id: string; name: string }[]
}) {
  const [driverId, setDriverId] = useState('')
  const [status, setStatus] = useState('')

  async function assign() {
    const res = await fetch('/api/orders/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, driverId }),
    })
    if (res.ok) {
      setStatus('Assigned!')
    } else {
      setStatus('Failed to assign')
    }
  }

  const quote = order.quoteSnapshot as { address?: string; price?: number }

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <p style={{ fontWeight: 500, marginBottom: 4 }}>{quote.address}</p>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>GHS {quote.price} — {order.customer.name}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <select
          value={driverId}
          onChange={(e) => setDriverId(e.target.value)}
          className="input-field"
          style={{ marginBottom: 0, flex: 1 }}
        >
          <option value="">Select a driver</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <button onClick={assign} disabled={!driverId} className="btn-primary">Assign</button>
      </div>
      {status && <p style={{ fontSize: 13, marginTop: 8 }}>{status}</p>}
    </div>
  )
}