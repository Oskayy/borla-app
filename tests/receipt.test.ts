// The PDF receipt builds, is a real PDF, and survives names the standard fonts can't print.
import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildReceiptPdf, receiptNumber } from '@/lib/receipt-pdf'

const sample = {
  orderId: '3f2a9c1e-7b44-4d2e-9a1b-0c5d8e7f6a21',
  customerName: 'Ɔkɔmfo Ɛsi Mensah',
  address: 'House 12, blue gate, near Chemu SHS, Tema Comm. 4',
  zoneName: 'Tema C9',
  collectionNight: '5 Oct 2026',
  paidAt: new Date('2026-10-05T15:12:00Z'),
  paymentRef: 'T123456789012345',
  lines: [
    { litres: 60, label: 'Medium bin', count: 2, lineTotal: 40 },
    { litres: 120, label: 'Large bin', count: 1, lineTotal: 30 },
  ],
  recyclableDiscount: 0,
  hazardSurcharge: 5,
  lateSurcharge: 0,
  total: 75,
  refunds: [{ amount: 25, status: 'PROCESSED', createdAt: new Date('2026-10-06T09:00:00Z') }],
  status: 'Done',
}

describe('PDF receipt', () => {
  it('numbers receipts from the order id', () => {
    expect(receiptNumber(sample.orderId)).toBe('TR-3F2A9C1E')
  })

  it('builds a PDF, including for names with Ghanaian letters', async () => {
    const bytes = await buildReceiptPdf(sample)
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(1000)
    // Keep a sample for a visual check (git-ignored folder).
    const dir = path.resolve(__dirname, '../.impeccable/review')
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'receipt-sample.pdf'), bytes)
  })
})
