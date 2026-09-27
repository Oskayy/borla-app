'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteDraftButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Delete this draft order? This cannot be undone.')) return

    setError('')
    setLoading(true)

    const res = await fetch('/api/orders/delete-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to delete order')
      return
    }

    router.refresh()
  }

  return (
    <div>
      {error && <p style={{ color: '#B3261E', fontSize: 12, marginTop: 4 }}>{error}</p>}
      <button
        onClick={handleDelete}
        disabled={loading}
        style={{
          background: 'none',
          border: '1px solid #B3261E',
          color: '#B3261E',
          borderRadius: 4,
          padding: '4px 10px',
          fontSize: 12,
          marginTop: 8,
        }}
      >
        {loading ? 'Deleting...' : 'Delete Draft'}
      </button>
    </div>
  )
}