import { BRAND } from '@/lib/brand'

// The Trashit logo. `variant`: "full" (icon + name), "mark" (icon only). `onDark` for dark backgrounds.
// The image files live in /public/brand, so a designer's final logo can replace them without code changes.
export default function Logo({
  variant = 'full',
  onDark = false,
  height = 28,
  suffix,
}: {
  variant?: 'full' | 'mark'
  onDark?: boolean
  height?: number
  suffix?: string // e.g. "Ops"
}) {
  const src = variant === 'mark' ? BRAND.logoMark : onDark ? BRAND.logoOnDark : BRAND.logo
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={BRAND.name} height={height} style={{ height, width: 'auto', display: 'block' }} />
      {suffix && (
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: height * 0.6, color: onDark ? '#fff' : 'var(--color-primary)' }}>
          {suffix}
        </span>
      )}
    </span>
  )
}
