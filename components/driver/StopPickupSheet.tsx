'use client'

import { useState } from 'react'
import { Camera } from 'lucide-react'
import Sheet from '@/components/kit/Sheet'
import ConfirmPickupButton from '@/app/dashboard/driver/confirm-pickup-button'

// The stop page's main button: opens a slide-up panel to take the pickup photo and confirm (or report a problem).
export default function StopPickupSheet({ orderId, address }: { orderId: string; address: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press flex min-h-16 w-full items-center justify-center gap-2.5 rounded-full bg-action px-6 text-lg font-bold text-on-action shadow-lift transition hover:brightness-110"
      >
        <Camera aria-hidden className="size-5" /> Confirm pickup
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Confirm pickup">
        <p className="-mt-2 text-sm text-ink-2">
          Take a photo of the bins at <span className="font-semibold text-ink">{address}</span>, then confirm.
        </p>
        <ConfirmPickupButton orderId={orderId} />
      </Sheet>
    </>
  )
}
