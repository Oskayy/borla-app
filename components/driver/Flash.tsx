'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'

// Messages that must outlive the card that produced them (the card often disappears when the page refreshes
// after a pickup or an unload). flash() keeps the message for this browser tab; <FlashHost /> shows it until dismissed.

export interface FlashMessage {
  id: string
  tone: 'ok' | 'warn'
  text: string
}

const KEY = 'trashit-flash'
const EVENT = 'trashit-flash'

function read(): FlashMessage[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as FlashMessage[]
  } catch {
    return []
  }
}
function write(list: FlashMessage[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // private mode: the message still shows until the page reloads
  }
}

export function flash(text: string, tone: FlashMessage['tone'] = 'ok') {
  const list = [...read(), { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, tone, text }].slice(-3)
  write(list)
  window.dispatchEvent(new CustomEvent(EVENT, { detail: list }))
}

export default function FlashHost() {
  const [list, setList] = useState<FlashMessage[]>([])

  useEffect(() => {
    // Pick up messages saved before a refresh, then follow new ones.
    const saved = read()
    if (saved.length) queueMicrotask(() => setList(saved))
    const on = (e: Event) => setList((e as CustomEvent<FlashMessage[]>).detail)
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])

  function dismiss(id: string) {
    const next = list.filter((m) => m.id !== id)
    write(next)
    setList(next)
  }

  if (list.length === 0) return null
  return (
    <div role="status" aria-live="polite" className="grid gap-2">
      {list.map((m) => (
        <div
          key={m.id}
          className={`anim-note flex items-start gap-3 rounded-card p-4 ring-1 ${m.tone === 'ok' ? 'bg-ok-wash ring-ok/30' : 'bg-danger-wash ring-danger/30'}`}
        >
          {m.tone === 'ok' ? (
            <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-ok-deep" />
          ) : (
            <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" />
          )}
          <p className="flex-1 text-[15px] font-medium">{m.text}</p>
          <button type="button" onClick={() => dismiss(m.id)} aria-label="Dismiss" className="-m-2 grid size-11 shrink-0 place-items-center rounded-control text-ink-3 hover:text-ink">
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
