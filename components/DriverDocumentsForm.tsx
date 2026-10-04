'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
    <div>
      {types.map((t) => (
        <div key={t.code} className="panel" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <p style={{ fontWeight: 600 }}>
              {t.label} {!t.required && <span style={{ fontWeight: 400, fontSize: 12, color: '#999' }}>(optional)</span>}
            </p>
            <p style={{ fontSize: 12, color: '#666' }}>{t.hint}</p>
            {have[t.code] && <p style={{ fontSize: 12, color: '#2F7A4D' }}>✓ Uploaded</p>}
          </div>
          <div>
            <input
              ref={(el) => {
                inputs.current[t.code] = el
              }}
              type="file"
              accept="image/*"
              capture={t.code === 'profile_photo' ? 'user' : 'environment'}
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) upload(t.code, f)
              }}
            />
            <button className={have[t.code] ? undefined : 'btn-primary'} onClick={() => inputs.current[t.code]?.click()} disabled={busy !== null}
              style={have[t.code] ? { background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '8px 12px', fontSize: 13 } : undefined}>
              {busy === t.code ? 'Uploading...' : have[t.code] ? 'Replace' : 'Take photo'}
            </button>
          </div>
        </div>
      ))}
      {error && <p style={{ color: '#B3261E', fontSize: 13, margin: '8px 0' }}>{error}</p>}
      {!submitted && (
        <button onClick={submit} disabled={sending || missingRequired.length > 0} className="btn-accent" style={{ width: '100%', marginTop: 8 }}>
          {sending ? 'Sending...' : missingRequired.length > 0 ? `Add ${missingRequired.map((m) => m.label).join(', ')} first` : 'Send for review'}
        </button>
      )}
    </div>
  )
}
