'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Check, Clock, X } from 'lucide-react'
import { BUTTON_PRIMARY, BUTTON_QUIET } from '@/components/ui'
import { compressImage } from '@/lib/compress-image'
import { VEHICLE_CHANGE_DOC, type VehicleChangeStage } from '@/lib/vehicle-change'

// Where an approved driver's change of vehicle stands: add a photo, send it, wait for ops, or see why it came back.
export default function VehicleChangeCard({
  stage,
  currentName,
  newName,
  note,
}: {
  stage: VehicleChangeStage
  currentName: string
  newName: string | null
  note: string | null
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState<'photo' | 'send' | 'cancel' | null>(null)
  const [error, setError] = useState('')

  async function upload(original: File) {
    setBusy('photo')
    setError('')
    try {
      const form = new FormData()
      form.append('type', VEHICLE_CHANGE_DOC)
      form.append('file', await compressImage(original))
      const res = await fetch('/api/driver/documents', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.error || 'Could not upload the photo')
      else router.refresh()
    } catch {
      setError('Could not reach Trashit. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  async function act(action: 'send' | 'cancel') {
    setBusy(action)
    setError('')
    try {
      const res = await fetch('/api/driver/vehicle-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.error || 'Could not save')
      else router.refresh()
    } catch {
      setError('Could not reach Trashit. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  if (stage === 'none') return null

  if (stage === 'sent_back') {
    return (
      <section className="rounded-card bg-surface p-5 ring-1 ring-line">
        <h2 className="text-base font-semibold tracking-tight">Vehicle change not approved</h2>
        <p className="mt-1 text-[15px] text-ink-2">
          Trashit said: <strong className="font-semibold text-ink">{note}</strong>. You&apos;re still set up with your {currentName.toLowerCase()}. To try
          again, choose the new vehicle below and save.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-card bg-surface p-5 ring-1 ring-action/40">
      <h2 className="text-base font-semibold tracking-tight">
        Changing to {newName ? `a ${newName.toLowerCase()}` : 'a new vehicle'}
      </h2>
      <p className="mt-1 text-[15px] text-ink-2">
        Until Trashit approves it, you keep getting stops sized for your {currentName.toLowerCase()}.
      </p>

      {stage === 'waiting' ? (
        <p className="mt-4 flex items-start gap-2.5 text-[15px]">
          <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-action" />
          Sent. Trashit will check the photo and let you know, usually within a day.
        </p>
      ) : (
        <ol className="mt-4 grid gap-3 text-[15px]">
          <li className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2.5">
              {stage === 'ready_to_send' ? (
                <Check aria-hidden className="size-4 text-action" strokeWidth={3} />
              ) : (
                <Camera aria-hidden className="size-4 text-ink-3" />
              )}
              A photo of the whole new vehicle, with its number plate if it has one
            </span>
            <button type="button" onClick={() => input.current?.click()} disabled={busy !== null} className={BUTTON_QUIET}>
              <Camera aria-hidden className="size-4" />
              {busy === 'photo' ? 'Uploading…' : stage === 'ready_to_send' ? 'Retake' : 'Take photo'}
            </button>
            <input
              ref={input}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) upload(f)
                e.target.value = ''
              }}
            />
          </li>
        </ol>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {stage !== 'waiting' && (
          <button type="button" onClick={() => act('send')} disabled={busy !== null || stage !== 'ready_to_send'} className={BUTTON_PRIMARY}>
            {busy === 'send' ? 'Sending…' : 'Send for approval'}
          </button>
        )}
        <button type="button" onClick={() => act('cancel')} disabled={busy !== null} className={BUTTON_QUIET}>
          <X aria-hidden className="size-4" /> {busy === 'cancel' ? 'Cancelling…' : 'Keep my current vehicle'}
        </button>
      </div>
      <p aria-live="polite" className="mt-2 text-sm text-danger">
        {error}
      </p>
    </section>
  )
}
