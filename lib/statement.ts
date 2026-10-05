// A driver's monthly earnings statement: what they earned and what was sent to their MoMo in one calendar month.
// Accra is UTC+0 all year, so a calendar month in Ghana is the same month in UTC.

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
  month: { year: number; month: number } // month 1-12
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
