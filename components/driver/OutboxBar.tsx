'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CloudOff, RefreshCw, X } from 'lucide-react'
import { drainOutbox, listOutbox, OUTBOX_EVENT, removeFromOutbox, type OutboxItem } from '@/lib/outbox'
import { flash } from '@/components/driver/Flash'

// Pickups and unloads kept on this phone while there was no signal (lib/outbox.ts). They send by themselves when the
// signal comes back, when the app opens and every half minute; the driver can also press "Send now".
export default function OutboxBar() {
  const [items, setItems] = useState<OutboxItem[]>([])
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  const refresh = useCallback(() => {
    listOutbox().then(setItems)
  }, [])

  const send = useCallback(async () => {
    setBusy(true)
    const { sent, failed } = await drainOutbox()
    setBusy(false)
    if (sent) {
      flash(sent === 1 ? 'Sent what was waiting on this phone.' : `Sent ${sent} things that were waiting on this phone.`)
      router.refresh()
    }
    if (failed) flash("Something waiting on this phone wasn't accepted. See the note at the top.", 'warn')
  }, [router])

  useEffect(() => {
    refresh()
    const first = window.setTimeout(send, 0) // try what is waiting as soon as the app opens
    const onChange = () => refresh()
    window.addEventListener(OUTBOX_EVENT, onChange)
    window.addEventListener('online', send)
    const timer = window.setInterval(send, 30_000)
    return () => {
      window.removeEventListener(OUTBOX_EVENT, onChange)
      window.removeEventListener('online', send)
      window.clearInterval(timer)
      window.clearTimeout(first)
    }
  }, [refresh, send])

  if (!items.length) return null
  const waiting = items.filter((i) => !i.error)
  const refused = items.filter((i) => i.error)

  return (
    <div className="mb-5 grid gap-2">
      {waiting.length > 0 && (
        <div role="status" className="flex items-start gap-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-line">
          <CloudOff aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-2" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {waiting.length === 1 ? '1 thing is' : `${waiting.length} things are`} waiting for signal
            </p>
            <p className="text-sm text-ink-2">
              {waiting.map((i) => i.label).join(', ')}. Saved on this phone with the photo; it sends by itself when you have signal. Keep the app open if you can.
            </p>
          </div>
          <button
            type="button"
            onClick={send}
            disabled={busy}
            className="press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1 ring-line-strong disabled:opacity-60"
          >
            <RefreshCw aria-hidden className={`size-4 ${busy ? 'animate-spin' : ''}`} /> {busy ? 'Sending' : 'Send now'}
          </button>
        </div>
      )}
      {refused.map((i) => (
        <div key={i.id} role="alert" className="flex items-start gap-3 rounded-card bg-danger-wash p-4 ring-1 ring-line">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{i.label} wasn&apos;t accepted</p>
            <p className="text-sm text-ink-2">{i.error} Open the stop to check it, or call Trashit support.</p>
          </div>
          <button
            type="button"
            onClick={() => removeFromOutbox(i.id)}
            aria-label={`Remove: ${i.label}`}
            className="press grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
      ))}
    </div>
  )
}
