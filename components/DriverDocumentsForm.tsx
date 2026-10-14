'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Camera, Check } from 'lucide-react'
import { BUTTON_PRIMARY, BUTTON_QUIET } from '@/components/ui'
import { compressImage } from '@/lib/compress-image'

interface DocType {
  code: string
  label: string
  hint: string
  required: boolean
}

export default function DriverDocumentsForm({
  types,
  uploaded,
  submitted,
}: {
  types: DocType[]
  uploaded: Record<string, string> // type -> when it was uploaded
  submitted: boolean
}) {
  const [have, setHave] = useState<Record<string, string>>(uploaded)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})
  const router = useRouter()

  async function upload(code: string, original: File) {
    setBusy(code)
    setError('')
    try {
      const file = await compressImage(original)
      const form = new FormData()
      form.append('type', code)
      form.append('file', file)
      const res = await fetch('/api/driver/documents', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not upload')
        return
      }
      setHave((h) => ({ ...h, [code]: new Date().toISOString() }))
    } catch {
      setError('Could not reach Trashit. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  async function submit() {
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/driver/documents/submit', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not send')
        return
      }
      router.refresh()
    } catch {
      setError('Could not reach Trashit. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const missingRequired = types.filter((t) => t.required && !have[t.code])

  return (
    <div className="grid gap-3">
      <ul className="grid gap-3">
        {types.map((t) => (
          <li key={t.code} className="flex flex-wrap items-center gap-4 rounded-card bg-surface p-4 ring-1 ring-line sm:p-5">
            <span
              className={`grid size-11 shrink-0 place-items-center rounded-full ${have[t.code] ? 'bg-ok-wash text-ok-deep' : 'bg-canvas text-ink-3 ring-1 ring-line'}`}
            >
              {have[t.code] ? <Check aria-hidden className="size-5" strokeWidth={3} /> : <Camera aria-hidden className="size-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {t.label} {!t.required && <span className="text-sm font-normal text-ink-3">(optional)</span>}
              </span>
              <span className="block text-sm text-ink-3">{t.hint}</span>
              {have[t.code] && <span className="block text-sm font-medium text-ok-deep">Uploaded</span>}
            </span>
            <input
              ref={(el) => {
                inputs.current[t.code] = el
              }}
              type="file"
              accept="image/*"
              capture={t.code === 'profile_photo' ? 'user' : 'environment'}
              className="hidden"
              aria-label={`${t.label} photo`}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) upload(t.code, f)
              }}
            />
            <button onClick={() => inputs.current[t.code]?.click()} disabled={busy !== null} className={BUTTON_QUIET}>
              {busy === t.code ? 'Uploading…' : have[t.code] ? 'Replace' : 'Take photo'}
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}
      {!submitted && (
        <button onClick={submit} disabled={sending || missingRequired.length > 0} className={`mt-2 w-full min-h-12 ${BUTTON_PRIMARY}`}>
          {sending ? 'Sending…' : missingRequired.length > 0 ? `Add ${missingRequired.map((m) => m.label).join(', ')} first` : 'Send for review'}
        </button>
      )}
    </div>
  )
}
