import type { Prisma } from '@prisma/client'
import { ghsToPesewas, pctToBps, splitColumns, splitOrder, storedSplit, type OrderSplit } from '@/lib/money-split'

type Tx = Prisma.TransactionClient

const SPLIT_SELECT = {
  quoteSnapshot: true,
  pricePesewas: true,
  platformFeePesewas: true,
  pickupSharePesewas: true,
  unloadSharePesewas: true,
  feeBps: true,
  pickupBps: true,
} as const

// The platform fee rate the order was priced with (from its price snapshot). Orders priced before the
// platform fee existed have none: 0, so drivers share the whole price as they always did.
function feeBpsFromSnapshot(snapshot: unknown): number {
  const pct = (snapshot as { platformFeePercent?: unknown } | null)?.platformFeePercent
  return typeof pct === 'number' && Number.isFinite(pct) ? pctToBps(pct) : 0
}

function priceFromSnapshot(snapshot: unknown): number {
  const price = (snapshot as { price?: unknown } | null)?.price
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) throw new Error('BAD_PRICE')
  return ghsToPesewas(price)
}

async function activePickupBps(tx: Tx): Promise<number> {
  const rule = await tx.payoutRule.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' }, select: { pickupPercent: true } })
  if (!rule) throw new Error('NO_PAYOUT_RULE')
  return pctToBps(rule.pickupPercent)
}

// Works out and stores an order's split when its payment is confirmed: the price paid (whole pesewas), the
// platform fee rate it was priced with, and the payout rule active right now. Called inside the payment's
// transaction; never changes a split that is already stored.
export async function freezeSplitAtPayment(tx: Tx, orderId: string, paidPesewas: number, snapshot: unknown): Promise<OrderSplit> {
  const split = splitOrder(paidPesewas, feeBpsFromSnapshot(snapshot), await activePickupBps(tx))
  await tx.order.updateMany({
    where: { id: orderId, pricePesewas: null },
    data: { ...splitColumns(split), splitFrozenAt: new Date() },
  })
  return (await getSplit(tx, orderId))!
}

// The order's stored split. Orders paid before splits were stored get one now, from their price snapshot and the
// active payout rule, and it is kept from then on (so pickup and unload use the same numbers).
export async function ensureSplit(tx: Tx, orderId: string): Promise<OrderSplit> {
  const existing = await getSplit(tx, orderId)
  if (existing) return existing
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { quoteSnapshot: true } })
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const split = splitOrder(priceFromSnapshot(order.quoteSnapshot), feeBpsFromSnapshot(order.quoteSnapshot), await activePickupBps(tx))
  await tx.order.updateMany({ where: { id: orderId, pricePesewas: null }, data: { ...splitColumns(split), splitFrozenAt: new Date() } })
  return (await getSplit(tx, orderId))!
}

async function getSplit(tx: Tx, orderId: string): Promise<OrderSplit | null> {
  const o = await tx.order.findUnique({ where: { id: orderId }, select: SPLIT_SELECT })
  return o ? storedSplit(o) : null
}
