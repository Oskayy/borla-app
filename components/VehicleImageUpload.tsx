'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

// Upload / replace / remove the photo for one vehicle type. The server re-checks everything.
export default function VehicleImageUpload({ vehicleId, imagePath }: { vehicleId: string; imagePath: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const isUploaded = !!imagePath && imagePath.startsWith('http')

  async function upload(file: File) {
    setError('')
    if (!ALLOWED.includes(file.type)) {
      setError('Please choose a JPEG, PNG or WebP picture')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('That picture is too large. Please use one under 2 MB.')
      return
    }

    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/admin/vehicle-types/${vehicleId}/image`, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not upload the picture')
        return
      }
      router.refresh()
    } catch {
      setError('Could not reach Borla. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setError('')
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/vehicle-types/${vehicleId}/image`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not remove the picture')
        return
      }
      router.refresh()
    } catch {
      setError('Could not reach Borla. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const linkButton = {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: 12,
    color: 'var(--color-primary)',
    textDecoration: 'underline',
  } as const

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} style={linkButton}>
          {busy ? 'Working...' : isUploaded ? 'Replace photo' : 'Upload photo'}
        </button>
        {isUploaded && !busy && (
          <button type="button" onClick={remove} style={{ ...linkButton, color: '#B3261E' }}>
            Remove photo
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // lets the same file be chosen again
          if (file) upload(file)
        }}
      />
      {error && <p style={{ color: '#B3261E', fontSize: 12, marginTop: 4 }}>{error}</p>}
    </div>
  )
}