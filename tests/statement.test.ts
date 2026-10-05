// The driver's monthly statement: month parsing, totals, a spreadsheet-safe CSV and a real PDF.
import { describe, expect, it } from 'vitest'
import { monthRange, parseMonth, recentMonths, statementCsv, statementTotals, type StatementData } from '@/lib/statement'
import { buildStatementPdf } from '@/lib/statement-pdf'

const now = new Date('2026-10-05T12:00:00Z')

const sample: StatementData = {
  driverName: 'Kwame Ɔsei',
  month: { year: 2026, month: 10 },
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
    expect(statementTotals(sample)).toEqual({ pickup: 22.5, unload: 18, earned: 40.5, sent: 25, stops: 2 })
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
