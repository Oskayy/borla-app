import { Check } from 'lucide-react'
import { TONE_PILL, type StatusTone } from '@/lib/order-status'

// A status chip. Colours mean the same in every app: waiting (blue) = waiting on Trashit,
// progress (amber) = on the way, done (green, with a tick) = finished, problem (red) = needs someone.
export default function Chip({ tone = 'neutral', children }: { tone?: StatusTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${TONE_PILL[tone]}`}>
      {tone === 'done' && <Check aria-hidden className="size-3" strokeWidth={3} />}
      {children}
    </span>
  )
}
