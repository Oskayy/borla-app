import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'
import { dateLabel, dateTimeLabel } from '@/lib/format'

// A one-page PDF receipt for a paid order.

export interface ReceiptData {
  orderId: string
  customerName: string
  address: string
  zoneName: string | null
  collectionNight: string | null // e.g. "5 Oct 2026"
  paidAt: Date
  paymentRef: string
  lines: { litres?: number; label: string; count: number; lineTotal?: number }[]
  recyclableDiscount: number
  hazardSurcharge: number
  lateSurcharge: number
  taxLines?: { label: string; percent: number; amount: number }[]
  total: number
  refunds: { amount: number; status: string; createdAt: Date }[]
  status: string // customer-facing label
}

export function receiptNumber(orderId: string): string {
  return `TR-${orderId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

const INK = rgb(0.07, 0.1, 0.15)
const MUTED = rgb(0.37, 0.42, 0.48)
const LINE = rgb(0.89, 0.9, 0.92)
const GREEN = rgb(0.07, 0.51, 0.35)

// Standard PDF fonts only cover Western European characters; map the rest to the closest plain letter.
const FALLBACK: Record<string, string> = { Ɔ: 'O', ɔ: 'o', Ɛ: 'E', ɛ: 'e', Ŋ: 'N', ŋ: 'n', '₵': 'GHS ' }
export function safe(font: PDFFont, text: string): string {
  let out = ''
  for (const ch of text.normalize('NFC')) {
    try {
      font.encodeText(ch)
      out += ch
    } catch {
      out += FALLBACK[ch] ?? ch.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '?')
    }
  }
  return out
}

const ghs = (n: number) => `GHS ${n.toFixed(2)}`

export async function buildReceiptPdf(d: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Trashit receipt ${receiptNumber(d.orderId)}`)
  pdf.setAuthor('Trashit')
  const page = pdf.addPage([595.28, 841.89]) // A4
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const left = 56
  const right = 595.28 - 56
  let y = 841.89 - 64

  const text = (p: PDFPage, s: string, x: number, yy: number, size = 10, font = regular, color = INK) =>
    p.drawText(safe(font, s), { x, y: yy, size, font, color })
  const textRight = (s: string, yy: number, size = 10, font = regular, color = INK) => {
    const t = safe(font, s)
    page.drawText(t, { x: right - font.widthOfTextAtSize(t, size), y: yy, size, font, color })
  }
  const rule = (yy: number) => page.drawLine({ start: { x: left, y: yy }, end: { x: right, y: yy }, thickness: 1, color: LINE })

  // Header
  text(page, 'Trashit', left, y, 22, bold, GREEN)
  textRight('Receipt', y + 4, 14, bold)
  y -= 18
  text(page, 'Night-time refuse collection, Ghana', left, y, 9, regular, MUTED)
  textRight(receiptNumber(d.orderId), y, 10, regular, MUTED)
  y -= 28
  rule(y)
  y -= 26

  // Who and when
  const meta: [string, string][] = [
    ['Billed to', d.customerName],
    ['Pickup address', d.address || '-'],
    ['Area', d.zoneName ?? '-'],
    ['Collection night', d.collectionNight ?? '-'],
    ['Paid', dateTimeLabel(d.paidAt)],
    ['Payment reference', d.paymentRef],
    ['Status', d.status],
  ]
  for (const [k, v] of meta) {
    text(page, k, left, y, 9, regular, MUTED)
    text(page, v.length > 70 ? `${v.slice(0, 69)}...` : v, left + 130, y, 10)
    y -= 18
  }
  y -= 12
  rule(y)
  y -= 24

  // Items
  text(page, 'Item', left, y, 9, bold, MUTED)
  textRight('Amount', y, 9, bold, MUTED)
  y -= 20
  for (const l of d.lines.filter((x) => x.count > 0)) {
    text(page, `${l.count} x ${l.litres ? `${l.litres} litre bin` : l.label}`, left, y, 11)
    if (typeof l.lineTotal === 'number') textRight(ghs(l.lineTotal), y, 11)
    y -= 20
  }
  const adjust: [string, number][] = []
  if (d.recyclableDiscount > 0) adjust.push(['Recyclable discount', -d.recyclableDiscount])
  if (d.hazardSurcharge > 0) adjust.push(['Hazardous items', d.hazardSurcharge])
  if (d.lateSurcharge > 0) adjust.push(['Late booking', d.lateSurcharge])
  for (const t of d.taxLines ?? []) if (t.amount > 0) adjust.push([`${t.label} (${t.percent}%)`, t.amount])
  for (const [k, v] of adjust) {
    text(page, k, left, y, 11, regular, MUTED)
    textRight(`${v < 0 ? '- ' : '+ '}${ghs(Math.abs(v))}`, y, 11, regular, MUTED)
    y -= 20
  }
  y -= 4
  rule(y)
  y -= 26
  text(page, 'Total paid', left, y, 13, bold)
  textRight(ghs(d.total), y, 16, bold)
  y -= 34

  // Refunds
  if (d.refunds.length > 0) {
    text(page, 'Refunds', left, y, 11, bold)
    y -= 18
    for (const r of d.refunds) {
      const state = r.status === 'PROCESSED' ? 'refunded' : r.status === 'FAILED' ? 'could not be sent' : 'on its way'
      text(page, `${dateLabel(r.createdAt)}  ${state}`, left, y, 10, regular, MUTED)
      textRight(`- ${ghs(r.amount)}`, y, 10, regular, MUTED)
      y -= 16
    }
    y -= 10
  }

  // Footer
  text(page, 'Paid through Paystack. Keep this receipt for your records.', left, 72, 9, regular, MUTED)
  text(page, `Issued ${dateTimeLabel(new Date())}`, left, 58, 9, regular, MUTED)

  return pdf.save()
}
