// Price calculation. Pure functions only (no database), so they can be unit-tested.
//
// price = (base fee + Σ (bin fee + per-bin charge) × count) × zone multiplier
//         − recyclable discount (on that subtotal)
//         + hazard surcharge (if hazardous)
//         + late surcharge (if booked after the planning snapshot)
//
// The platform fee does not change what the customer pays. It is Trashit's share of the price,
// taken before the driver's pickup/disposal split:
//   platform fee = price × platformFeePercent
//   driver pool  = price − platform fee
import type { JsonBody } from './validate'
import { NO_TAX, taxLines, taxTotal, type TaxRates } from './tax'

export const WASTE_TYPES = ['general', 'recyclable'] as const
export type WasteType = (typeof WASTE_TYPES)[number]

export const MAX_BINS_PER_SIZE = 20
export const MAX_BINS_PER_ORDER = 30

export interface RuleBinPrice {
  binSizeId: string
  code: string
  label: string
  litres: number
  fee: number
}

export interface RuleForQuote {
  id: string
  name: string
  baseFee: number
  volumeRate: number // per-bin charge
  hazardSurcharge: number
  lateSurcharge: number
  platformFeePercent: number
  separatedDiscountPercent: number
  bins: RuleBinPrice[]
}

export interface ZoneForQuote {
  id: string
  name: string
  priceMultiplier: number
}

export interface OrderInput {
  bins: Record<string, number> // bin size code -> count
  wasteType: WasteType
  hazardous: boolean
}

export interface QuoteLine {
  code: string
  label: string
  litres: number
  count: number
  binFee: number
  perBinCharge: number
  lineTotal: number
}

export interface PriceBreakdown {
  ruleId: string
  ruleName: string
  zoneId: string
  zoneName: string
  zoneMultiplier: number
  lines: QuoteLine[]
  totalBins: number
  totalLitres: number
  baseFee: number
  subtotal: number
  recyclableDiscount: number
  hazardSurcharge: number
  lateSurcharge: number
  price: number // what the customer pays, tax included
  netPrice?: number // before tax (absent on orders priced before tax existed: same as price)
  taxLines?: { code: string; label: string; percent: number; amount: number }[]
  taxTotal?: number
  platformFeePercent: number
  platformFee: number
  driverPool: number
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// Validates the order details a customer sends. Returns null when anything is wrong.
export function parseOrderInput(body: JsonBody): OrderInput | null {
  const wasteType = body?.wasteType
  if (typeof wasteType !== 'string' || !(WASTE_TYPES as readonly string[]).includes(wasteType)) return null

  const hazardous = body?.hazardous === undefined ? false : body.hazardous
  if (typeof hazardous !== 'boolean') return null

  const raw = body?.bins
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const bins: Record<string, number> = {}
  let total = 0
  for (const [code, count] of Object.entries(raw)) {
    if (!/^[a-z0-9_-]{1,30}$/.test(code)) return null
    if (!Number.isInteger(count) || (count as number) < 0 || (count as number) > MAX_BINS_PER_SIZE) return null
    if ((count as number) > 0) {
      bins[code] = count as number
      total += count as number
    }
  }
  if (total < 1 || total > MAX_BINS_PER_ORDER) return null

  return { bins, wasteType: wasteType as WasteType, hazardous }
}

// Returns the breakdown, or an error message when the order uses a bin size the rule doesn't price.
// Same fields whether it worked or not (like lib/auth.ts), so it type-checks with strict mode off.
// Rule of use: if `ok` is false, read `error` and stop. Only read `breakdown` after that check.
export interface PriceResult {
  ok: boolean
  error: string
  breakdown: PriceBreakdown
}

export function calculatePrice(
  rule: RuleForQuote,
  zone: ZoneForQuote,
  input: OrderInput,
  isLate: boolean,
  tax: TaxRates = NO_TAX
): PriceResult {
  const lines: QuoteLine[] = []

  for (const [code, count] of Object.entries(input.bins)) {
    const bin = rule.bins.find((b) => b.code === code)
    if (!bin) return { ok: false, error: `Bin size "${code}" is not available`, breakdown: null as unknown as PriceBreakdown }
    lines.push({
      code,
      label: bin.label,
      litres: bin.litres,
      count,
      binFee: bin.fee,
      perBinCharge: rule.volumeRate,
      lineTotal: round2((bin.fee + rule.volumeRate) * count),
    })
  }

  // Keep a stable order (small -> large) for display and snapshots.
  lines.sort((a, b) => a.litres - b.litres)

  const binsTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)
  const subtotal = round2((rule.baseFee + binsTotal) * zone.priceMultiplier)
  const recyclableDiscount =
    input.wasteType === 'recyclable' ? round2(subtotal * (rule.separatedDiscountPercent / 100)) : 0
  const hazardSurcharge = input.hazardous ? round2(rule.hazardSurcharge) : 0
  const lateSurcharge = isLate ? round2(rule.lateSurcharge) : 0

  const netPrice = round2(Math.max(0, subtotal - recyclableDiscount + hazardSurcharge + lateSurcharge))
  // Tax on top of the price (lib/tax.ts; every rate 0 until confirmed).
  const taxes = taxLines(Math.round(netPrice * 100), tax)
  const taxTotalGhs = taxTotal(taxes) / 100
  const price = round2(netPrice + taxTotalGhs)
  const platformFee = round2(netPrice * (rule.platformFeePercent / 100))

  return {
    ok: true,
    error: '',
    breakdown: {
      ruleId: rule.id,
      ruleName: rule.name,
      zoneId: zone.id,
      zoneName: zone.name,
      zoneMultiplier: zone.priceMultiplier,
      lines,
      totalBins: lines.reduce((s, l) => s + l.count, 0),
      totalLitres: lines.reduce((s, l) => s + l.litres * l.count, 0),
      baseFee: rule.baseFee,
      subtotal,
      recyclableDiscount,
      hazardSurcharge,
      lateSurcharge,
      price,
      netPrice,
      taxLines: taxes.map((t) => ({ code: t.code, label: t.label, percent: t.bps / 100, amount: t.amount / 100 })),
      taxTotal: taxTotalGhs,
      platformFeePercent: rule.platformFeePercent,
      platformFee,
      driverPool: round2(netPrice - platformFee),
    },
  }
}

