import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { requoteDraft } from '@/lib/pricing'
import { getAcceptHazardous } from '@/lib/settings'
import { initializeTransaction } from '@/lib/paystack'
import { checkCheckout, CHECKOUT_REUSE_MINUTES } from '@/lib/payment-confirm-server'

// Starts paying for a booking (a DRAFT order) on Paystack.
//  - The price is worked out again now (lib/pricing.ts requoteDraft), never an old one. If it changed since the
//    customer saw it, nothing starts: they are shown the new price and press Pay again.
//  - Each checkout has our own reference, stored on the order, so the payment can be checked with Paystack if its
//    webhook is late or lost (lib/payment-confirm-server.ts).
//  - Pressing Pay twice, or coming back within CHECKOUT_REUSE_MINUTES, reuses the same checkout page.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['CUSTOMER'])
  if (!auth.ok) return auth.response
  const { user } = auth

  if (await enforceRateLimit({ identifier: user.id, action: 'start_payment', maxAttempts: 10, windowMinutes: 10 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const orderId = body?.orderId
  if (!isUuid(orderId)) {
    return NextResponse.json({ error: "Something didn't go through. Please refresh the page and try again." }, { status: 400 })
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.customerId !== user.id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.status !== 'DRAFT') {
    return NextResponse.json({ error: 'This order has already been paid or can no longer be paid' }, { status: 400 })
  }

  // The photo rule is enforced here on the server, not just in the browser.
  const photoCount = await prisma.orderEvidence.count({ where: { orderId, type: 'customer_placement' } })
  if (photoCount < 1) {
    return NextResponse.json({ error: 'A photo of your waste is required before payment' }, { status: 400 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl || !user.email) {
    console.error('[payments] NEXT_PUBLIC_SITE_URL is not set, or the customer has no email')
    return NextResponse.json({ error: 'Payment is temporarily unavailable' }, { status: 500 })
  }

  // An earlier checkout for this booking may have gone through already: ask Paystack before starting another.
  if (order.paystackReference && (await checkCheckout(order.id)) === 'paid') {
    return NextResponse.json({ error: 'This booking is already paid. Refresh your orders to see it.', paid: true }, { status: 409 })
  }

  const oldPrice = (order.quoteSnapshot as { price?: number } | null)?.price
  const priced = await requoteDraft(order)
  if (!priced.ok) return NextResponse.json({ error: priced.error }, { status: priced.status })
  if (priced.quote.hazardous && !(await getAcceptHazardous())) {
    return NextResponse.json({ error: "We can't collect hazardous waste at the moment. Please delete this booking." }, { status: 400 })
  }
  const price = priced.quote.price
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "We couldn't work out the price for this booking. Please book again, or contact Trashit support." }, { status: 400 })
  }
  const changed = Math.round(price * 100) !== Math.round((oldPrice ?? -1) * 100)
  const now = new Date()

  // Same price, and a checkout started a moment ago: send the customer back to it rather than starting a second one.
  if (
    !changed &&
    order.checkoutUrl &&
    order.checkoutStartedAt &&
    now.getTime() - order.checkoutStartedAt.getTime() < CHECKOUT_REUSE_MINUTES * 60_000
  ) {
    return NextResponse.json({ authorizationUrl: order.checkoutUrl })
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { quoteSnapshot: priced.quote as unknown as Prisma.InputJsonValue, zoneId: priced.quote.zoneId ?? order.zoneId, checkoutUrl: null },
  })
  if (changed) {
    return NextResponse.json(
      {
        error: `The price for this booking is now GHS ${price.toFixed(2)}${typeof oldPrice === 'number' ? ` (it was GHS ${oldPrice.toFixed(2)})` : ''}. Press Pay again to pay the new price.`,
        priceChanged: true,
        price,
      },
      { status: 409 }
    )
  }

  const reference = `trashit-${orderId.slice(0, 8)}-${crypto.randomBytes(6).toString('hex')}`
  const r = await initializeTransaction({
    email: user.email,
    amountPesewas: Math.round(price * 100),
    reference,
    orderId,
    callbackUrl: `${siteUrl}/dashboard/customer/orders/${orderId}`,
  })
  if (!r.ok) {
    console.error('[payments] Paystack initialize failed:', r.error)
    return NextResponse.json({ error: r.uncertain ? 'Could not reach the payment provider. Please try again.' : 'Could not start payment. Please try again.' }, { status: 502 })
  }
  await prisma.order.update({
    where: { id: orderId },
    data: { paystackReference: reference, checkoutUrl: r.data.authorization_url, checkoutStartedAt: now, paymentCheckedAt: null },
  })
  return NextResponse.json({ authorizationUrl: r.data.authorization_url })
}
