'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Truck } from 'lucide-react'
import { compressImage } from '@/lib/compress-image'

// Tap the picture to take or choose a new one. `round` for the profile picture, square for the vehicle.
export default function PhotoUpload({
  type,
  url,
  fallback,
  round = false,
  label,
}: {
  type: string // driver document type: 'avatar' | 'vehicle_photo'
  url: string | null
  fallback?: string // initials for a profile picture
  round?: boolean
  label: string
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function upload(original: File) {
    setBusy(true)
    setError('')
    setPreview(URL.createObjectURL(original))
    try {
      const form = new FormData()
      form.append('type', type)
      form.append('file', await compressImage(original))
      const res = await fetch('/api/driver/documents', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not upload the photo')
        setPreview(null)
      } else router.refresh()
    } catch {
      setError('Could not reach Trashit. Please try again.')
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  const shown = preview ?? url
  const shape = round ? 'size-20 rounded-full' : 'aspect-[4/3] w-full rounded-card'
  return (
    <div className={round ? 'shrink-0' : ''}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={label}
        className={`press group relative grid place-items-center overflow-hidden bg-canvas ring-1 ring-line ${shape} ${busy ? 'opacity-70' : ''}`}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="size-full object-cover" />
        ) : round ? (
          <span className="grid size-full place-items-center bg-action text-xl font-semibold text-on-action">{fallback}</span>
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-sm text-ink-3">
            <Truck aria-hidden className="size-7" /> Add a photo of your vehicle
          </span>
        )}
        <span
          className={`absolute grid place-items-center rounded-full bg-action text-on-action shadow-card ring-2 ring-surface ${
            round ? 'bottom-0 right-0 size-7' : 'bottom-3 right-3 size-10'
          }`}
        >
          <Camera aria-hidden className={round ? 'size-3.5' : 'size-5'} />
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) upload(f)
        }}
      />
      {busy && <p className="mt-1.5 text-xs text-ink-3">Uploading…</p>}
      <p aria-live="polite" className="mt-1.5 text-xs text-danger empty:hidden">
        {error}
      </p>
    </div>
  )
}
