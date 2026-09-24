'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ConfirmDisposalButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function confirmDisposal() {
    setLoading(true)
    const res = await fetch('/api/orders/confirm-disposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    })
    setLoading(false)
    if (res.ok) {
      router.refresh()
    } else {
      alert('Failed to confirm disposal')
    }
  }

  return (
    <button onClick={confirmDisposal} disabled={loading} style={{ padding: 8, width: '100%' }}>
      {loading ? 'Confirming...' : 'Confirm Disposal'}
    </button>
  )
}