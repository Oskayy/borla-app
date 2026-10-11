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
// for the wasted trip; the rest is refunded. Placeholder (25%).
export const ATTEMPT_FEE_BPS = 2_500

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
export function splitOrder(price: number, feeBps: number, pickupBps: number): OrderSplit {
  whole(price, 'PRICE')
  whole(feeBps, 'FEE')
  whole(pickupBps, 'SPLIT')
  if (feeBps > BPS || pickupBps > BPS) throw new Error('BAD_BPS')
  const platformFee = Math.floor((price * feeBps) / BPS)
  const pool = price - platformFee
  const pickup = Math.floor((pool * pickupBps) / BPS)
  return { price, feeBps, pickupBps, platformFee, pool, pickup, unload: pool - pickup }
}

export interface AttemptSplit {
  attemptFee: number // kept from the price for the wasted trip
  driverShare: number // paid to the driver: the attempt fee minus the platform fee on it
  platformShare: number // Trashit keeps
  refund: number // back to the customer: price - attemptFee
}

// A failed pickup that was the customer's fault. Always: driverShare + platformShare + refund = price.
export function attemptSplit(price: number, feeBps: number, attemptBps = ATTEMPT_FEE_BPS): AttemptSplit {
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
