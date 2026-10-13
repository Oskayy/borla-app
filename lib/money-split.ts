// How an order's price is shared out. Pure functions so they can be tested.
//
// Ground rules (Payment flow rewrite, step 2):
//  - Money is whole pesewas (GHS 12.50 = 1250), never decimals.
//  - Percentages are basis points (1% = 100 bps, 40% = 4000). Multiply first, divide last, round down.
//  - The last share is always "what is left", so the parts add up to the whole exactly.
// The split is worked out once, when payment is confirmed, and stored on the order: a later change to the
// pricing or payout rules only affects new orders.

export const BPS = 10_000

// Customer's fault failed pickup (bin not out, gate locked, wrong pin): this share of the price is kept to pay
// for the wasted trip; the rest is refunded. The percentage is a pricing rule setting (0-25%, decided Oct 2026).
export const MAX_ATTEMPT_FEE_PERCENT = 25

// The pricing rule's attempt fee as basis points, kept within 0-25%.
export function attemptFeeBps(percent: number | null | undefined): number {
  const p = typeof percent === 'number' && Number.isFinite(percent) ? percent : 0
  return pctToBps(Math.min(MAX_ATTEMPT_FEE_PERCENT, Math.max(0, p)))
}

export function pctToBps(percent: number): number {
  if (!Number.isFinite(percent)) throw new Error('BAD_PERCENT')
  return Math.min(BPS, Math.max(0, Math.round(percent * 100)))
}

export function ghsToPesewas(ghs: number): number {
  return Math.round(ghs * 100)
}

export function pesewasToGhs(pesewas: number): number {
  return pesewas / 100
}

function whole(n: number, what: string) {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`BAD_${what}`)
}

export interface OrderSplit {
  price: number // pesewas paid
  feeBps: number // platform fee rate used
  pickupBps: number // pickup share of the driver pool
  platformFee: number // Trashit's share
  pool: number // what drivers share: price - platformFee
  pickup: number // paid at pickup
  unload: number // paid at unload: pool - pickup (the remainder)
}

// price - platform fee = driver pool; pool split into pickup and unload. Always: pickup + unload + platformFee = price.
// Surcharges and the recyclable discount (step 7): each split by a percentage set on the payout rule.
//  - late and hazardous surcharges pay for the driver's extra effort: `lateDriverBps` / `hazardDriverBps` of each
//    goes to the drivers (the rest to Trashit), instead of being split like the rest of the price;
//  - the recyclable discount: `discountPlatformBps` of it comes out of Trashit's share, so drivers are paid as if
//    that part of the discount hadn't been given (the work is the same).
export interface SplitExtras {
  lateSurcharge: number // pesewas
  hazardSurcharge: number
  recyclableDiscount: number
  lateDriverBps: number
  hazardDriverBps: number
  discountPlatformBps: number
}

// price - platform fee = driver pool; pool split into pickup and unload. Always: pickup + unload + platformFee = price.
// `price` is before tax (tax is never shared out).
export function splitOrder(price: number, feeBps: number, pickupBps: number, x?: SplitExtras): OrderSplit {
  whole(price, 'PRICE')
  whole(feeBps, 'FEE')
  whole(pickupBps, 'SPLIT')
  if (feeBps > BPS || pickupBps > BPS) throw new Error('BAD_BPS')
  let pool: number
  if (!x) {
    pool = price - Math.floor((price * feeBps) / BPS)
  } else {
    for (const [k, v] of Object.entries(x)) whole(v, k.toUpperCase())
    if (x.lateDriverBps > BPS || x.hazardDriverBps > BPS || x.discountPlatformBps > BPS) throw new Error('BAD_BPS')
    // What the drivers' share is worked out on: the price without surcharges, plus the part of the discount Trashit absorbs.
    const base = Math.max(0, price - x.lateSurcharge - x.hazardSurcharge) + Math.floor((x.recyclableDiscount * x.discountPlatformBps) / BPS)
    pool =
      base -
      Math.floor((base * feeBps) / BPS) +
      Math.floor((x.lateSurcharge * x.lateDriverBps) / BPS) +
      Math.floor((x.hazardSurcharge * x.hazardDriverBps) / BPS)
    pool = Math.min(price, Math.max(0, pool)) // Trashit's share never goes below zero
  }
  const platformFee = price - pool
  const pickup = Math.floor((pool * pickupBps) / BPS)
  return { price, feeBps, pickupBps, platformFee, pool, pickup, unload: pool - pickup }
}

// Distance bonus (step 7): for a stop far from the driver's home base, a bonus per km beyond the free distance,
// capped, and never more than Trashit's platform fee on the order (it is paid from it).
export function distanceBonus(km: number, rule: { freeKm: number; perKmPesewas: number; capPesewas: number }, platformFee: number): number {
  if (!Number.isFinite(km) || km <= rule.freeKm || rule.perKmPesewas <= 0) return 0
  return Math.max(0, Math.min(Math.floor((km - rule.freeKm) * rule.perKmPesewas), rule.capPesewas, platformFee))
}

export interface AttemptSplit {
  attemptFee: number // kept from the price for the wasted trip
  driverShare: number // paid to the driver: the attempt fee minus the platform fee on it
  platformShare: number // Trashit keeps
  refund: number // back to the customer: price - attemptFee
}

// A failed pickup that was the customer's fault. Always: driverShare + platformShare + refund = price.
export function attemptSplit(price: number, feeBps: number, attemptBps: number): AttemptSplit {
  whole(price, 'PRICE')
  const attemptFee = Math.floor((price * attemptBps) / BPS)
  const platformShare = Math.floor((attemptFee * feeBps) / BPS)
  return { attemptFee, driverShare: attemptFee - platformShare, platformShare, refund: price - attemptFee }
}

// The split stored on an order (null for orders paid before splits were stored).
export function storedSplit(o: {
  pricePesewas: number | null
  platformFeePesewas: number | null
  pickupSharePesewas: number | null
  unloadSharePesewas: number | null
  feeBps: number | null
  pickupBps: number | null
}): OrderSplit | null {
  if (
    o.pricePesewas == null ||
    o.platformFeePesewas == null ||
    o.pickupSharePesewas == null ||
    o.unloadSharePesewas == null ||
    o.feeBps == null ||
    o.pickupBps == null
  ) {
    return null
  }
  return {
    price: o.pricePesewas,
    feeBps: o.feeBps,
    pickupBps: o.pickupBps,
    platformFee: o.platformFeePesewas,
    pool: o.pickupSharePesewas + o.unloadSharePesewas,
    pickup: o.pickupSharePesewas,
    unload: o.unloadSharePesewas,
  }
}

// The columns to save on the order.
export function splitColumns(s: OrderSplit) {
  return {
    pricePesewas: s.price,
    platformFeePesewas: s.platformFee,
    pickupSharePesewas: s.pickup,
    unloadSharePesewas: s.unload,
    feeBps: s.feeBps,
    pickupBps: s.pickupBps,
  }
}
