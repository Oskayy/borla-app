'use client'

import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

// A slide-up sheet on phones (a centred card on wider screens), built on the native <dialog>: focus stays
// inside, Escape closes it, and focus goes back to whatever opened it. Tapping the dimmed page closes it too.
export default function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="sheet"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex flex-col gap-4 p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:p-6">
        <span aria-hidden className="mx-auto -mt-1 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-xl font-semibold tracking-tight">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="press -m-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-canvas hover:text-ink">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
