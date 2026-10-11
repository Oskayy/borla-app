// The driver's monthly statement: month parsing, totals, a spreadsheet-safe CSV and a real PDF.
import { describe, expect, it } from 'vitest'
import { monthRange, parseMonth, parsePeriod, recentMonths, recentPeriods, statementCsv, statementTotals, weekStart, type StatementData } from '@/lib/statement'
import { buildStatementPdf } from '@/lib/statement-pdf'

const now = new Date('2026-10-05T12:00:00Z')

const sample: StatementData = {
  driverName: 'Kwame Ɔsei',
  period: { label: 'October 2026', key: '2026-10' },
  earnings: [
    { date: new Date('2026-10-02T21:10:00Z'), orderRef: 'TR-AAAA0001', address: 'House 12, blue gate, Tema', kind: 'pickup', amount: 12 },
    { date: new Date('2026-10-02T23:40:00Z'), orderRef: 'TR-AAAA0001', address: 'House 12, blue gate, Tema', kind: 'unload', amount: 18 },
    { date: new Date('2026-10-03T22:00:00Z'), orderRef: 'TR-AAAA0002', address: '=HYPERLINK("http://x")', kind: 'pickup', amount: 10.5 },
  ],
  withdrawals: [
    { date: new Date('2026-10-04T08:00:00Z'), reference: 'borla-wd-1', wallet: 'MTN 0240000000', status: 'Sent', amount: 25 },
    { date: new Date('2026-10-04T09:00:00Z'), reference: 'borla-wd-2', wallet: 'MTN 0240000000', status: 'Not approved', amount: 5 },
  ],
}

describe('driver statement', () => {
  it('accepts past and current months only', () => {
    expect(parseMonth('2026-10', now)).toEqual({ year: 2026, month: 10 })
    expect(parseMonth('2026-11', now)).toBeNull()
    expect(parseMonth('2026-13', now)).toBeNull()
    expect(parseMonth('10-2026', now)).toBeNull()
    expect(parseMonth(null, now)).toBeNull()
  })

  it('covers the whole calendar month', () => {
    const { from, to } = monthRange({ year: 2026, month: 12 })
    expect(from.toISOString()).toBe('2026-12-01T00:00:00.000Z')
    expect(to.toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })

  it('lists recent months newest first, across the year boundary', () => {
    expect(recentMonths(3, new Date('2026-02-10T00:00:00Z'))).toEqual([
      { year: 2026, month: 2 },
      { year: 2026, month: 1 },
      { year: 2025, month: 12 },
    ])
  })

  it('totals only what was earned and what was actually sent', () => {
    expect(statementTotals(sample)).toEqual({ pickup: 22.5, unload: 18, attempt: 0, takenBack: 0, earned: 40.5, sent: 25, stops: 2 })
  })

  it('writes a CSV a spreadsheet will not run as formulas', () => {
    const csv = statementCsv(sample)
    expect(csv.startsWith('﻿Date,Type,')).toBe(true)
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`)
    expect(csv).toContain('2026-10-04,Withdrawal,,MTN 0240000000,borla-wd-1,Sent,-25.00')
    expect(csv.trim().split('\r\n')).toHaveLength(6)
  })

  it('builds a PDF, over several pages for a busy month', async () => {
    const busy = { ...sample, earnings: Array.from({ length: 120 }, (_, i) => ({ ...sample.earnings[i % 3] })) }
    const bytes = await buildStatementPdf(busy)
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-')
    const { PDFDocument } = await import('pdf-lib')
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1)
  })
})

describe('statement periods', () => {
  const q = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null })
  const now = new Date('2026-10-05T12:00:00Z') // a Monday

  it('weeks start on a Monday and run 7 days', () => {
    const p = parsePeriod(q({ week: '2026-09-28' }), now)
    expect(p?.label).toBe('Week of 28 Sept 2026')
    expect(p?.to.toISOString()).toBe('2026-10-05T00:00:00.000Z')
    expect(parsePeriod(q({ week: '2026-09-29' }), now)).toBeNull() // a Tuesday
    expect(parsePeriod(q({ week: '2026-10-12' }), now)).toBeNull() // future
  })

  it('years cover the whole calendar year, up to this one', () => {
    expect(parsePeriod(q({ year: '2026' }), now)?.to.toISOString()).toBe('2027-01-01T00:00:00.000Z')
    expect(parsePeriod(q({ year: '2027' }), now)).toBeNull()
  })

  it('months still work, and the lists start with the current period', () => {
    expect(parsePeriod(q({ month: '2026-10' }), now)?.label).toBe('October 2026')
    const r = recentPeriods(now)
    expect(r.weeks[0].from.toISOString().slice(0, 10)).toBe('2026-10-05')
    expect(weekStart(new Date('2026-10-11T23:00:00Z')).toISOString().slice(0, 10)).toBe('2026-10-05')
    expect(r.months[0].key).toBe('2026-10')
  })
})
