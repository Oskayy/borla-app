import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

const TONES = {
  ok: { box: 'bg-ok-wash ring-ok/30', icon: CheckCircle2, iconClass: 'text-ok-deep' },
  info: { box: 'bg-info-wash ring-info/25', icon: Info, iconClass: 'text-info' },
  warn: { box: 'bg-warn-wash ring-warn/35', icon: AlertTriangle, iconClass: 'text-warn-deep' },
  problem: { box: 'bg-danger-wash ring-danger/30', icon: AlertTriangle, iconClass: 'text-danger' },
} as const

// A confirmation or heads-up note: "Pickup confirmed", "Saved", "Payment is being checked".
// Announced to screen readers; problems are announced at once.
export default function Note({
  tone = 'ok',
  children,
  onDismiss,
  className = '',
}: {
  tone?: keyof typeof TONES
  children: React.ReactNode
  onDismiss?: () => void
  className?: string
}) {
  const t = TONES[tone]
  const Icon = t.icon
  return (
    <div role={tone === 'problem' ? 'alert' : 'status'} className={`anim-note flex items-start gap-3 rounded-card p-4 ring-1 ${t.box} ${className}`}>
      <Icon aria-hidden className={`mt-0.5 size-5 shrink-0 ${t.iconClass}`} />
      <div className="min-w-0 flex-1 text-[15px] font-medium text-ink">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="press -m-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:text-ink">
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  )
}
