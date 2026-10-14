'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Truck } from 'lucide-react'
import { compressImage } from '@/lib/compress-image'

// Tap the picture (or the button) to take or choose a new one. `round` for the profile picture, square for the vehicle.
// `size` sets the round picture's size; `withButton` adds a labelled button beside it.
export default function PhotoUpload({
  type,
  url,
  fallback,
  round = false,
  label,
  size = 'size-20',
  withButton = false,
}: {
  type: string // driver document type: 'avatar' | 'vehicle_photo'
  url: string | null
  fallback?: string // initials for a profile picture
  round?: boolean
  label: string
  size?: string
  withButton?: boolean
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

  const pick = () => input.current?.click()
  const shown = preview ?? url

  const picture = round ? (
    // The camera badge sits on the edge, outside the clipped circle, so it's always fully visible.
    <div className={`relative shrink-0 ${size}`}>
      <button
        type="button"
        onClick={pick}
        disabled={busy}
        aria-label={label}
        className={`press grid size-full place-items-center overflow-hidden rounded-full bg-canvas ring-2 ring-line ${busy ? 'opacity-70' : ''}`}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center bg-action text-xl font-semibold text-on-action">{fallback}</span>
        )}
      </button>
      <button
        type="button"
        onClick={pick}
        disabled={busy}
        tabIndex={-1}
        aria-hidden
        className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full bg-action text-on-action shadow-lift ring-4 ring-surface transition hover:brightness-95"
      >
        <Camera className="size-[18px]" strokeWidth={2.4} />
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={pick}
      disabled={busy}
      aria-label={label}
      className={`press relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-card bg-canvas ring-1 ring-line ${busy ? 'opacity-70' : ''}`}
    >
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shown} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex flex-col items-center gap-1.5 text-sm text-ink-3">
          <Truck aria-hidden className="size-7" /> Add a photo of your vehicle
        </span>
      )}
      <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-action px-3.5 py-2 text-sm font-semibold text-on-action shadow-lift">
        <Camera aria-hidden className="size-4" /> {shown ? 'Change photo' : 'Add photo'}
      </span>
    </button>
  )

  return (
    <div className={withButton ? 'flex items-center gap-4' : round ? 'shrink-0' : ''}>
      {picture}
      {withButton && (
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className="press inline-flex min-h-11 items-center gap-2 rounded-control px-4 text-[15px] font-semibold text-action-deep ring-1 ring-action/50 hover:bg-action-wash disabled:opacity-60"
        >
          <Camera aria-hidden className="size-4" /> {busy ? 'Uploading…' : shown ? 'Change photo' : 'Add a photo'}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        aria-label={label}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) upload(f)
        }}
      />
      {!withButton && busy && <p className="mt-1.5 text-xs text-ink-3">Uploading…</p>}
      <p aria-live="polite" className="mt-1.5 text-xs text-danger empty:hidden">
        {error}
      </p>
    </div>
  )
}
