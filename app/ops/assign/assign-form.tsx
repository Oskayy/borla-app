'use client'

import { useState } from 'react'

export default function AssignForm({ order, drivers }: { order: any; drivers: any[] }) {
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
    <div style={{ border: '1px solid #ccc', padding: 10, marginBottom: 10 }}>
      <p><strong>Order:</strong> {order.id.slice(0, 8)}... — {quote.address} — GHS {quote.price}</p>
      <p><strong>Customer:</strong> {order.customer.name}</p>
      <select value={driverId} onChange={(e) => setDriverId(e.target.value)} style={{ padding: 6, marginRight: 10 }}>
        <option value="">Select a driver</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
      <button onClick={assign} disabled={!driverId} style={{ padding: 6 }}>Assign</button>
      {status && <p>{status}</p>}
    </div>
  )
}