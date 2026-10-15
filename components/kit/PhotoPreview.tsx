'use client'

import { useEffect, useState } from 'react'

// Shows the photo someone just took, before it is sent, so they can check it (and retake it if needed).
export default function PhotoPreview({ file, label = 'Your photo' }: { file: File | null; label?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file) {
      queueMicrotask(() => setUrl(null))
      return
    }
    const u = URL.createObjectURL(file)
    queueMicrotask(() => setUrl(u))
    return () => URL.revokeObjectURL(u)
  }, [file])
  if (!url) return null
  return (
    <figure className="anim-pop overflow-hidden rounded-[18px] bg-canvas ring-1 ring-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="block max-h-72 w-full object-cover" />
      <figcaption className="px-3.5 py-2 text-xs font-medium text-ink-3">{label}. Retake it if it isn&apos;t clear.</figcaption>
    </figure>
  )
}
