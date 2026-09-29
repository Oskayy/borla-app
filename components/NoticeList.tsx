'use client'

import { useState } from 'react'

interface Notice {
  id: string
  title: string
  body: string
}

// Unread messages (e.g. "Your pickup has moved to tonight"), each with a dismiss button.
export default function NoticeList({ notices }: { notices: Notice[] }) {
  const [list, setList] = useState(notices)

  async function dismiss(id: string) {
    setList((l) => l.filter((n) => n.id !== id))
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {})
  }

  if (list.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      {list.map((n) => (
        <div key={n.id} className="panel" style={{ borderLeft: '4px solid var(--color-accent)', display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</p>
            <p style={{ fontSize: 13, color: '#444' }}>{n.body}</p>
          </div>
          <button
            onClick={() => dismiss(n.id)}
            aria-label="Dismiss"
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666', alignSelf: 'flex-start' }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
