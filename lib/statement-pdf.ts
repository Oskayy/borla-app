import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'
import { dateLabel, dateTimeLabel } from '@/lib/format'
import { safe } from '@/lib/receipt-pdf'
import { monthLabel, statementTotals, type StatementData } from '@/lib/statement'

// A driver's monthly earnings statement as an A4 PDF (runs onto more pages when the month is busy).

const INK = rgb(0.07, 0.1, 0.15)
const MUTED = rgb(0.37, 0.42, 0.48)
const LINE = rgb(0.89, 0.9, 0.92)
const AMBER = rgb(0.72, 0.45, 0.08)

const W = 595.28
const H = 841.89
const LEFT = 56
const RIGHT = W - 56
const BOTTOM = 90

const ghs = (n: number) => `GHS ${n.toFixed(2)}`

export async function buildStatementPdf(d: StatementData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const title = `Trashit earnings statement, ${monthLabel(d.month)}`
  pdf.setTitle(title)
  pdf.setAuthor('Trashit')
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  let page: PDFPage = pdf.addPage([W, H])
  let y = H - 64

  const text = (s: string, x: number, yy: number, size = 10, font: PDFFont = regular, color = INK) =>
    page.drawText(safe(font, s), { x, y: yy, size, font, color })
  const textRight = (s: string, xRight: number, yy: number, size = 10, font: PDFFont = regular, color = INK) => {
    const t = safe(font, s)
    page.drawText(t, { x: xRight - font.widthOfTextAtSize(t, size), y: yy, size, font, color })
  }
  const fit = (s: string, width: number, size: number) => {
    let t = safe(regular, s)
    if (regular.widthOfTextAtSize(t, size) <= width) return t
    while (t.length > 1 && regular.widthOfTextAtSize(`${t}...`, size) > width) t = t.slice(0, -1)
    return `${t}...`
  }
  const rule = (yy: number) => page.drawLine({ start: { x: LEFT, y: yy }, end: { x: RIGHT, y: yy }, thickness: 1, color: LINE })
  const room = (needed: number) => {
    if (y - needed >= BOTTOM) return
    page = pdf.addPage([W, H])
    y = H - 64
    text(title, LEFT, y, 9, regular, MUTED)
    y -= 28
  }

  // Header
  text('Trashit', LEFT, y, 22, bold, AMBER)
  textRight('Earnings statement', RIGHT, y + 4, 14, bold)
  y -= 18
  text('Night-time refuse collection, Ghana', LEFT, y, 9, regular, MUTED)
  textRight(monthLabel(d.month), RIGHT, y, 10, regular, MUTED)
  y -= 28
  rule(y)
  y -= 24
  text('Driver', LEFT, y, 9, regular, MUTED)
  text(d.driverName, LEFT + 130, y, 10)
  y -= 18
  text('Period', LEFT, y, 9, regular, MUTED)
  text(monthLabel(d.month), LEFT + 130, y, 10)
  y -= 30

  // Summary
  const t = statementTotals(d)
  const summary: [string, string][] = [
    ['Stops paid', String(t.stops)],
    ['Pickup shares', ghs(t.pickup)],
    ['Unload shares', ghs(t.unload)],
  ]
  for (const [k, v] of summary) {
    text(k, LEFT, y, 11, regular, MUTED)
    textRight(v, RIGHT, y, 11)
    y -= 20
  }
  y -= 2
  rule(y)
  y -= 24
  text('Earned this month', LEFT, y, 13, bold)
  textRight(ghs(t.earned), RIGHT, y, 16, bold)
  y -= 22
  text('Sent to your MoMo this month', LEFT, y, 11, regular, MUTED)
  textRight(ghs(t.sent), RIGHT, y, 11)
  y -= 36

  // Earnings, one line each
  const COL_DATE = LEFT
  const COL_WHAT = LEFT + 82
  const COL_ADDR = LEFT + 170
  room(60)
  text('Earnings', LEFT, y, 12, bold)
  y -= 20
  if (d.earnings.length === 0) {
    text('No earnings this month.', LEFT, y, 10, regular, MUTED)
    y -= 20
  } else {
    text('Date', COL_DATE, y, 9, bold, MUTED)
    text('Share', COL_WHAT, y, 9, bold, MUTED)
    text('Order and address', COL_ADDR, y, 9, bold, MUTED)
    textRight('Amount', RIGHT, y, 9, bold, MUTED)
    y -= 16
    for (const e of d.earnings) {
      room(16)
      text(dateLabel(e.date), COL_DATE, y, 9)
      text(e.kind === 'pickup' ? 'Pickup' : 'Unload', COL_WHAT, y, 9)
      page.drawText(fit(`${e.orderRef}  ${e.address}`, RIGHT - 70 - COL_ADDR, 9), { x: COL_ADDR, y, size: 9, font: regular, color: INK })
      textRight(ghs(e.amount), RIGHT, y, 9)
      y -= 16
    }
  }
  y -= 18

  // Withdrawals
  room(60)
  text('Withdrawals', LEFT, y, 12, bold)
  y -= 20
  if (d.withdrawals.length === 0) {
    text('No withdrawals this month.', LEFT, y, 10, regular, MUTED)
    y -= 20
  } else {
    text('Date', COL_DATE, y, 9, bold, MUTED)
    text('Wallet and reference', COL_WHAT, y, 9, bold, MUTED)
    text('Status', RIGHT - 170, y, 9, bold, MUTED)
    textRight('Amount', RIGHT, y, 9, bold, MUTED)
    y -= 16
    for (const w of d.withdrawals) {
      room(16)
      text(dateLabel(w.date), COL_DATE, y, 9)
      page.drawText(fit(`${w.wallet}  ${w.reference}`, RIGHT - 180 - COL_WHAT, 9), { x: COL_WHAT, y, size: 9, font: regular, color: INK })
      page.drawText(fit(w.status, 100, 9), { x: RIGHT - 170, y, size: 9, font: regular, color: INK })
      textRight(ghs(w.amount), RIGHT, y, 9)
      y -= 16
    }
  }

  // Footer on every page
  const pages = pdf.getPages()
  pages.forEach((p, i) => {
    p.drawText(safe(regular, 'Amounts are your share of each order after the Trashit platform fee.'), { x: LEFT, y: 72, size: 9, font: regular, color: MUTED })
    p.drawText(safe(regular, `Issued ${dateTimeLabel(new Date())}  ·  Page ${i + 1} of ${pages.length}`), { x: LEFT, y: 58, size: 9, font: regular, color: MUTED })
  })

  return pdf.save()
}
