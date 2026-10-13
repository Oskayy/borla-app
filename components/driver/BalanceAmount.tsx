'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// The big balance on the Earnings card, with an eye button to hide it (handy when someone is looking over
// your shoulder). Hidden only on this screen until the page is opened again.
export default function BalanceAmount({ amount }: { amount: number }) {
  const [hidden, setHidden] = useState(false)
  return (
    <p className="mt-1 flex items-center gap-2">
      <span className="whitespace-nowrap text-[34px] font-bold leading-none tabular-nums tracking-[-0.02em]">
        {hidden ? (
          <>
            GHS ••••<span className="sr-only">(hidden)</span>
          </>
        ) : (
          `GHS ${amount.toFixed(2)}`
        )}
      </span>
      <button
        type="button"
        onClick={() => setHidden((h) => !h)}
        aria-pressed={hidden}
        aria-label={hidden ? 'Show balance' : 'Hide balance'}
        className="press grid size-11 place-items-center rounded-full text-on-hero-2 transition hover:bg-white/10 hover:text-on-hero"
      >
        {hidden ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
      </button>
    </p>
  )
}
