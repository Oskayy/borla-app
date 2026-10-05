// A driver's earnings statement: what they earned and what was sent to their MoMo in one week, month or year.
// Accra is UTC+0 all year, so periods in Ghana are the same in UTC.

export interface StatementEarning {
  date: Date
  orderRef: string // short order reference, e.g. "TR-3F2A9C1E"
  address: string
  kind: 'pickup' | 'unload'
  amount: number
}

export interface StatementWithdrawal {
  date: Date
  reference: string
  wallet: string // e.g. "MTN 024xxxxxxx"
  status: string // driver-facing label
  amount: number
}

export interface StatementData {
  driverName: string
  period: { label: string; key: string }
  earnings: StatementEarning[]
  withdrawals: StatementWithdrawal[]
}

// "2026-10" -> { year: 2026, month: 10 }; anything else -> null. Months in the future are refused.
export function parseMonth(value: string | null, now: Date = new Date()): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? '')
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12 || year < 2024) return null
  if (year * 12 + month > now.getUTCFullYear() * 12 + now.getUTCMonth() + 1) return null
  return { year, month }
}

export function monthRange({ year, month }: { year: number; month: number }): { from: Date; to: Date } {
  return { from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 1)) }
}

export function monthKey({ year, month }: { year: number; month: number }): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function monthLabel({ year, month }: { year: number; month: number }): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })
}

// The last `count` months, newest first, for the download menu.
export function recentMonths(count: number, now: Date = new Date()): { year: number; month: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
  })
}

// A statement period: a week (Monday to Sunday), a calendar month, or a calendar year.
export interface Period {
  kind: 'week' | 'month' | 'year'
  key: string // "2026-W2026-09-28", "2026-10", "2026"
  label: string // "Week of 28 Sept 2026", "October 2026", "2026"
  from: Date
  to: Date
}

const DAY = 86_400_000
const ymd = (d: Date) => d.toISOString().slice(0, 10)

// The Monday that starts the week containing `d` (UTC, which is Ghana time).
export function weekStart(d: Date): Date {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY)
}

function weekPeriod(start: Date): Period {
  const label = start.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
  return { kind: 'week', key: `week-${ymd(start)}`, label: `Week of ${label}`, from: start, to: new Date(start.getTime() + 7 * DAY) }
}
function monthPeriod(m: { year: number; month: number }): Period {
  return { kind: 'month', key: monthKey(m), label: monthLabel(m), ...monthRange(m) }
}
function yearPeriod(year: number): Period {
  return { kind: 'year', key: String(year), label: String(year), from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year + 1, 0, 1)) }
}

// ?week=YYYY-MM-DD (a Monday) | ?month=YYYY-MM | ?year=YYYY. Future periods are refused.
export function parsePeriod(params: { get(name: string): string | null }, now: Date = new Date()): Period | null {
  const week = params.get('week')
  if (week) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return null
    const d = new Date(`${week}T00:00:00Z`)
    if (Number.isNaN(d.getTime()) || d.getUTCDay() !== 1 || d > now || d.getUTCFullYear() < 2024) return null
    return weekPeriod(d)
  }
  const year = params.get('year')
  if (year) {
    const y = /^\d{4}$/.test(year) ? Number(year) : NaN
    if (!(y >= 2024 && y <= now.getUTCFullYear())) return null
    return yearPeriod(y)
  }
  const m = parseMonth(params.get('month'), now)
  return m ? monthPeriod(m) : null
}

// The download lists: last `count` weeks, months and years, newest first.
export function recentPeriods(now: Date = new Date()) {
  const thisWeek = weekStart(now)
  return {
    weeks: Array.from({ length: 8 }, (_, i) => weekPeriod(new Date(thisWeek.getTime() - i * 7 * DAY))),
    months: recentMonths(6, now).map(monthPeriod),
    years: [now.getUTCFullYear(), now.getUTCFullYear() - 1].filter((y) => y >= 2026).map(yearPeriod),
  }
}

export function periodQuery(p: Period): string {
  return p.kind === 'week' ? `week=${ymd(p.from)}` : p.kind === 'month' ? `month=${p.key}` : `year=${p.key}`
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function statementTotals(d: StatementData) {
  const pickup = round2(d.earnings.filter((e) => e.kind === 'pickup').reduce((s, e) => s + e.amount, 0))
  const unload = round2(d.earnings.filter((e) => e.kind === 'unload').reduce((s, e) => s + e.amount, 0))
  const sent = round2(d.withdrawals.filter((w) => w.status === 'Sent').reduce((s, w) => s + w.amount, 0))
  return { pickup, unload, earned: round2(pickup + unload), sent, stops: new Set(d.earnings.map((e) => e.orderRef)).size }
}

// One CSV cell. Text that a spreadsheet would run as a formula (= + - @, tab, CR) gets a leading apostrophe.
function cell(v: string | number): string {
  if (typeof v === 'number') return v.toFixed(2)
  const t = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

// A CSV that opens cleanly in Excel and Google Sheets: one row per earning or withdrawal.
export function statementCsv(d: StatementData): string {
  const rows: (string | number)[][] = [['Date', 'Type', 'Order', 'Address or wallet', 'Reference', 'Status', 'Amount (GHS)']]
  for (const e of d.earnings) {
    rows.push([isoDate(e.date), e.kind === 'pickup' ? 'Pickup share' : 'Unload share', e.orderRef, e.address, '', 'Earned', e.amount])
  }
  for (const w of d.withdrawals) {
    rows.push([isoDate(w.date), 'Withdrawal', '', w.wallet, w.reference, w.status, -w.amount])
  }
  const sorted = [rows[0], ...rows.slice(1).sort((a, b) => String(a[0]).localeCompare(String(b[0])))]
  // A byte-order mark so Excel reads the file as UTF-8 (Ghanaian names and addresses).
  return '﻿' + sorted.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}
