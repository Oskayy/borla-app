// Small charts for the ops console, drawn as SVG on the server (no chart library). Colours come from the ops theme
// tokens, so they follow light and dark mode. Every chart has an aria-label that says what it shows in words.

const C = {
  main: 'var(--color-action)',
  soft: 'var(--color-action-wash)',
  sky: 'var(--color-highlight)',
  line: 'var(--color-line)',
  ink: 'var(--color-ink)',
  ink3: 'var(--color-ink-3)',
  surface: 'var(--color-surface)',
  danger: 'var(--color-danger)',
  warn: 'var(--color-warn)',
}

export const CHART_COLOURS = [C.main, C.sky, 'var(--color-warn)', 'var(--color-info)', 'var(--color-ink-3)']

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-GB') : n.toLocaleString('en-GB', { maximumFractionDigits: 1 }))

// Rounds the top of an axis up to a tidy number (1, 2, 2.5 or 5 times a power of ten).
function niceMax(v: number): number {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const m = v / p
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p
}

// Columns, one per label; the highlighted one (e.g. tonight) is solid and labelled with its value.
export function BarChart({ data, highlight = data.length - 1, label, unit = '' }: { data: { label: string; value: number }[]; highlight?: number; label: string; unit?: string }) {
  const w = 520
  const h = 170
  const left = 34
  const top = 18
  const max = niceMax(Math.max(...data.map((d) => d.value), 1))
  const bw = (w - left - 6) / Math.max(data.length, 1)
  const y = (v: number) => top + (h - top) * (1 - v / max)
  return (
    <svg viewBox={`0 0 ${w} ${h + 26}`} width="100%" role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${fmt(d.value)}${unit}`).join(', ')}`}>
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={left} x2={w - 4} y1={y(max * t)} y2={y(max * t)} stroke={C.line} strokeDasharray="3 4" />
          <text x={0} y={y(max * t) + 4} fontSize={10} fill={C.ink3}>
            {fmt(max * t)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const on = i === highlight
        const x = left + i * bw + bw * 0.18
        const bh = Math.max((h - top) * (d.value / max), d.value > 0 ? 3 : 0)
        return (
          <g key={d.label + i}>
            <rect x={x} y={h - bh} width={bw * 0.64} height={bh} rx={Math.min(10, bw * 0.2)} fill={on ? C.main : C.soft} />
            {on && (
              <text x={x + bw * 0.32} y={h - bh - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.ink}>
                {fmt(d.value)}
                {unit}
              </text>
            )}
            <text x={x + bw * 0.32} y={h + 17} textAnchor="middle" fontSize={11} fill={on ? C.ink : C.ink3} fontWeight={on ? 700 : 400}>
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// A line with a soft fill under it; the last point is marked.
export function AreaChart({ data, label, unit = '', colour = C.main }: { data: { label: string; value: number }[]; label: string; unit?: string; colour?: string }) {
  const w = 520
  const h = 150
  const pad = 10
  if (data.length < 2) return <p className="text-sm text-ink-3">Not enough history yet.</p>
  const vals = data.map((d) => d.value)
  const max = Math.max(...vals)
  const min = Math.min(0, ...vals)
  const span = max - min || 1
  const step = (w - pad * 2) / (data.length - 1)
  const pts = vals.map((v, i) => [pad + i * step, pad + (h - pad * 2) * (1 - (v - min) / span)])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  const id = `area-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <svg viewBox={`0 0 ${w} ${h + 22}`} width="100%" role="img" aria-label={`${label}: ${data.map((p) => `${p.label} ${fmt(p.value)}${unit}`).join(', ')}`}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={colour} stopOpacity={0.28} />
          <stop offset="1" stopColor={colour} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d} L${last[0]} ${h} L${pad} ${h} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={colour} strokeWidth={2.5} strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={5} fill={colour} stroke={C.surface} strokeWidth={3} />
      {data.map((p, i) =>
        data.length <= 8 || i % Math.ceil(data.length / 6) === 0 || i === data.length - 1 ? (
          <text key={p.label + i} x={pad + i * step} y={h + 16} textAnchor="middle" fontSize={11} fill={C.ink3}>
            {p.label}
          </text>
        ) : null
      )}
    </svg>
  )
}

// A ring split into parts, with the total in the middle and a legend beside it.
export function Donut({ parts, centre, sub, label }: { parts: { label: string; value: number; colour?: string }[]; centre: string; sub: string; label: string }) {
  const r = 62
  const circ = 2 * Math.PI * r
  const total = parts.reduce((n, p) => n + p.value, 0)
  let offset = 0
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 170 170" width={140} height={140} role="img" aria-label={`${label}: ${parts.map((p) => `${p.label} ${p.value}`).join(', ')}`} className="shrink-0">
        <circle cx={85} cy={85} r={r} fill="none" stroke="var(--color-canvas)" strokeWidth={20} />
        {total > 0 &&
          parts.map((p, i) => {
            const len = (circ * p.value) / total
            const seg = (
              <circle
                key={p.label}
                cx={85}
                cy={85}
                r={r}
                fill="none"
                stroke={p.colour ?? CHART_COLOURS[i % CHART_COLOURS.length]}
                strokeWidth={20}
                strokeDasharray={`${Math.max(len - (parts.length > 1 ? 3 : 0), 0)} ${circ}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 85 85)"
              />
            )
            offset += len
            return seg
          })}
        <text x={85} y={86} textAnchor="middle" fontSize={26} fontWeight={700} fill={C.ink}>
          {centre}
        </text>
        <text x={85} y={106} textAnchor="middle" fontSize={11} fill={C.ink3}>
          {sub}
        </text>
      </svg>
      <ul className="grid min-w-[9rem] flex-1 gap-2 text-sm">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: p.colour ?? CHART_COLOURS[i % CHART_COLOURS.length] }} />
            <span className="min-w-0 flex-1 truncate">{p.label}</span>
            <b className="tabular-nums">{p.value}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

// A half ring of ticks filled up to `value` of `max` (e.g. drivers online of drivers working tonight).
export function Gauge({ value, max, centre, sub, label }: { value: number; max: number; centre: string; sub: string; label: string }) {
  const n = 24
  const share = max > 0 ? value / max : 0
  return (
    <svg viewBox="0 0 240 140" width="100%" role="img" aria-label={`${label}: ${value} of ${max}`}>
      {Array.from({ length: n }, (_, i) => {
        const t = i / (n - 1)
        const a = Math.PI * (1 - t)
        const on = max > 0 && t <= share && value > 0
        return (
          <line
            key={i}
            x1={120 + 70 * Math.cos(a)}
            y1={125 - 70 * Math.sin(a)}
            x2={120 + 100 * Math.cos(a)}
            y2={125 - 100 * Math.sin(a)}
            stroke={on ? (t < 0.5 ? C.sky : C.main) : 'var(--color-canvas)'}
            strokeWidth={9}
            strokeLinecap="round"
          />
        )
      })}
      <text x={120} y={112} textAnchor="middle" fontSize={30} fontWeight={700} fill={C.ink}>
        {centre}
      </text>
      <text x={120} y={133} textAnchor="middle" fontSize={11} fill={C.ink3}>
        {sub}
      </text>
    </svg>
  )
}

// A tiny trend line for a table cell.
export function Sparkline({ values, label, bad = false }: { values: number[]; label: string; bad?: boolean }) {
  if (values.length < 2) return <span className="text-ink-3">—</span>
  const w = 84
  const h = 24
  const max = Math.max(...values)
  const min = Math.min(...values)
  const step = w / (values.length - 1)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)} ${(h - 3 - (h - 6) * ((v - min) / (max - min || 1))).toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} role="img" aria-label={`${label}: ${values.map(fmt).join(', ')}`} className="shrink-0">
      <path d={d} fill="none" stroke={bad ? C.danger : C.main} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  )
}

// Rows of labelled horizontal bars from a shared zero, positive to the right and negative to the left
// (e.g. "Whose money is it?"). The last row can be the total.
export function DivergingBars({ rows, label }: { rows: { label: string; value: number; total?: boolean }[]; label: string }) {
  const w = 520
  const labelW = 150
  const rowH = 32
  const plot = w - labelW - 70
  const maxPos = Math.max(...rows.map((r) => Math.max(r.value, 0)), 1)
  const maxNeg = Math.max(...rows.map((r) => Math.max(-r.value, 0)), 0)
  const scale = plot / (maxPos + maxNeg)
  const zero = labelW + maxNeg * scale
  return (
    <svg viewBox={`0 0 ${w} ${rows.length * rowH + 6}`} width="100%" role="img" aria-label={`${label}: ${rows.map((r) => `${r.label} ${fmt(r.value)}`).join(', ')}`}>
      <line x1={zero} x2={zero} y1={0} y2={rows.length * rowH} stroke={C.line} />
      {rows.map((r, i) => {
        const bw = Math.max(Math.abs(r.value) * scale, 2)
        const x = r.value >= 0 ? zero : zero - bw
        const y = i * rowH + 6
        const fill = r.total ? C.main : r.value >= 0 ? C.sky : C.danger
        return (
          <g key={r.label}>
            <text x={0} y={y + 14} fontSize={12} fill={r.total ? C.ink : 'var(--color-ink-2)'} fontWeight={r.total ? 700 : 400}>
              {r.label}
            </text>
            <rect x={x} y={y} width={bw} height={20} rx={6} fill={fill} opacity={r.total ? 1 : 0.85} />
            <text x={r.value >= 0 ? x + bw + 6 : x - 6} y={y + 14} fontSize={12} fontWeight={700} fill={C.ink} textAnchor={r.value >= 0 ? 'start' : 'end'}>
              {fmt(r.value)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// One coloured square per day (e.g. the daily money checks): green matched, amber explained, red to check.
export function DaySquares({ days }: { days: { label: string; state: 'ok' | 'explained' | 'check' | 'none' }[] }) {
  const COL = { ok: 'bg-ok-strong', explained: 'bg-warn', check: 'bg-danger', none: 'bg-canvas ring-1 ring-line' } as const
  const WORD = { ok: 'matched', explained: 'differences explained', check: 'differences to check', none: 'not run' } as const
  return (
    <ul className="grid grid-cols-7 gap-1.5 sm:grid-cols-14" aria-label="Daily money checks">
      {days.map((d) => (
        <li key={d.label} title={`${d.label}: ${WORD[d.state]}`} className={`aspect-square rounded-md ${COL[d.state]}`}>
          <span className="sr-only">
            {d.label}: {WORD[d.state]}
          </span>
        </li>
      ))}
    </ul>
  )
}
