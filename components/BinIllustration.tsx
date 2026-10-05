// A wheelie bin drawn to scale, so customers can see roughly how big 30, 60 and 120 litre bins are.
// Modelled on standard Ghanaian street bins: green body tapering to the base, a lid with a lip and handle,
// the white waste symbol on the front, and wheels (small castors on the smallest bin).
// Heights are proportional (a 120 L bin is about twice as tall as a 30 L one); the drawing sits on a shared baseline.

interface Shape {
  h: number // body height
  top: number // body width at the top
  base: number // body width at the bottom
  wheel: number // wheel radius
}

function shapeFor(litres: number): Shape {
  if (litres <= 40) return { h: 46, top: 40, base: 34, wheel: 4 }
  if (litres <= 80) return { h: 58, top: 50, base: 42, wheel: 7 }
  if (litres <= 150) return { h: 84, top: 54, base: 44, wheel: 10 }
  return { h: 98, top: 62, base: 50, wheel: 11 }
}

export default function BinIllustration({ litres, active = false, className = '' }: { litres: number; active?: boolean; className?: string }) {
  const s = shapeFor(litres)
  const W = 80
  const H = 120
  const ground = H - 4
  const bodyBottom = ground - s.wheel * 1.4
  const bodyTop = bodyBottom - s.h
  const cx = W / 2
  const lidH = 8
  const body = active ? '#12825a' : '#2f9a6b'
  const shade = active ? '#0b6646' : '#24805a'
  const lid = active ? '#0b6646' : '#1f7550'
  const discR = Math.min(s.top, s.h) * 0.22
  const discY = bodyTop + lidH + Math.max(discR + 6, s.h * 0.34)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={`${litres} litre bin`}>
      {/* ground shadow */}
      <ellipse cx={cx} cy={ground} rx={s.base / 2 + 8} ry="2.5" fill="currentColor" opacity="0.12" />
      {/* wheels */}
      <circle cx={cx - s.base / 2 + s.wheel * 0.6} cy={ground - s.wheel} r={s.wheel} fill="#1b222c" />
      <circle cx={cx + s.base / 2 - s.wheel * 0.6} cy={ground - s.wheel} r={s.wheel} fill="#1b222c" />
      <circle cx={cx - s.base / 2 + s.wheel * 0.6} cy={ground - s.wheel} r={s.wheel * 0.4} fill="#5c6675" />
      <circle cx={cx + s.base / 2 - s.wheel * 0.6} cy={ground - s.wheel} r={s.wheel * 0.4} fill="#5c6675" />
      {/* body: tapers towards the base */}
      <path
        d={`M ${cx - s.top / 2} ${bodyTop + lidH} L ${cx + s.top / 2} ${bodyTop + lidH} L ${cx + s.base / 2} ${bodyBottom} Q ${cx} ${bodyBottom + 3} ${cx - s.base / 2} ${bodyBottom} Z`}
        fill={body}
      />
      {/* side shading and ribs */}
      <path d={`M ${cx + s.top / 2 - 6} ${bodyTop + lidH} L ${cx + s.top / 2} ${bodyTop + lidH} L ${cx + s.base / 2} ${bodyBottom} L ${cx + s.base / 2 - 5} ${bodyBottom} Z`} fill={shade} />
      <line x1={cx - s.top / 2 + 6} y1={bodyTop + lidH + 4} x2={cx - s.base / 2 + 5} y2={bodyBottom - 3} stroke={shade} strokeWidth="1.2" />
      {/* lid with lip and handle */}
      <rect x={cx - s.top / 2 - 3} y={bodyTop} width={s.top + 6} height={lidH} rx="2.5" fill={lid} />
      <rect x={cx - s.top / 2 - 3} y={bodyTop + lidH - 2} width={s.top + 6} height="2" fill="#000" opacity="0.15" />
      <rect x={cx - s.top / 4} y={bodyTop - 3} width={s.top / 2} height="4" rx="2" fill={lid} />
      {/* waste symbol */}
      <circle cx={cx} cy={discY} r={discR} fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.95" />
      <g stroke="#fff" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.95">
        <rect x={cx - discR * 0.5} y={discY - discR * 0.05} width={discR * 0.5} height={discR * 0.55} rx="0.6" />
        <circle cx={cx + discR * 0.35} cy={discY - discR * 0.5} r={discR * 0.13} fill="#fff" />
        <path d={`M ${cx + discR * 0.35} ${discY - discR * 0.35} L ${cx + discR * 0.3} ${discY + discR * 0.15} L ${cx + discR * 0.45} ${discY + discR * 0.6}`} />
        <path d={`M ${cx + discR * 0.32} ${discY - discR * 0.2} L ${cx - discR * 0.15} ${discY - discR * 0.3}`} />
      </g>
    </svg>
  )
}
