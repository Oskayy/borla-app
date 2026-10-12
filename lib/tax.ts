// Tax on prices (step 7). Every rate is 0 until Trashit's accountant confirms them; the app already shows,
// records and refunds tax so turning a rate on needs no code change. Pure functions; amounts in pesewas.
//
// Each line is charged on the price before tax and rounded to the nearest pesewa. (Whether VAT should instead be
// charged on the price plus the levies is for the accountant to confirm.)

export interface TaxRates {
  vatBps: number
  nhilBps: number
  getfundBps: number
}

export const NO_TAX: TaxRates = { vatBps: 0, nhilBps: 0, getfundBps: 0 }

const LINES: { code: string; label: string; key: keyof TaxRates }[] = [
  { code: 'nhil', label: 'NHIL', key: 'nhilBps' },
  { code: 'getfund', label: 'GETFund levy', key: 'getfundBps' },
  { code: 'vat', label: 'VAT', key: 'vatBps' },
]

export interface TaxLine {
  code: string
  label: string
  bps: number
  amount: number // pesewas
}

// The tax lines on a price (only those with a rate above 0).
export function taxLines(netPesewas: number, rates: TaxRates): TaxLine[] {
  return LINES.filter((l) => rates[l.key] > 0).map((l) => ({
    code: l.code,
    label: l.label,
    bps: rates[l.key],
    amount: Math.round((netPesewas * rates[l.key]) / 10_000),
  }))
}

export function taxTotal(lines: { amount: number }[]): number {
  return lines.reduce((s, l) => s + l.amount, 0)
}

// Tax withheld from a driver payout (0 until confirmed). Rounded down, so the driver is never short-changed.
export function withholding(amountPesewas: number, bps: number): number {
  return bps > 0 ? Math.floor((amountPesewas * bps) / 10_000) : 0
}

// The tax on a price snapshot (orders priced before tax existed have none).
export function snapshotTax(snapshot: unknown): number {
  const t = (snapshot as { taxTotal?: unknown } | null)?.taxTotal
  return typeof t === 'number' && Number.isFinite(t) && t > 0 ? Math.round(t * 100) : 0
}
