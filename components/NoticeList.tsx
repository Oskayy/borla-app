'use client'

import { useState } from 'react'
import { BellRing, X } from 'lucide-react'

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
    <ul role="status" className="mb-5 grid gap-2">
      {list.map((n) => (
        <li key={n.id} className="anim-note flex items-start gap-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-line/70">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-action-wash text-action-deep">
            <BellRing aria-hidden className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{n.title}</p>
            <p className="text-sm text-ink-2">{n.body}</p>
          </div>
          <button
            type="button"
            onClick={() => dismiss(n.id)}
            aria-label="Dismiss"
            className="press -m-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-canvas hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  )
}
