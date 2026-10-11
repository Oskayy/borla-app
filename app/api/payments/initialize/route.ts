import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'

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
  const photoCount = await prisma.orderEvidence.count({
    where: { orderId, type: 'customer_placement' },
  })
  if (photoCount < 1) {
    return NextResponse.json({ error: 'A photo of your waste is required before payment' }, { status: 400 })
  }

  const quote = order.quoteSnapshot as { price?: number } | null
  const price = quote?.price
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "We couldn't work out the price for this booking. Please book again, or contact Trashit support." }, { status: 400 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!siteUrl || !secret) {
    console.error('[payments] NEXT_PUBLIC_SITE_URL or PAYSTACK_SECRET_KEY is not set')
    return NextResponse.json({ error: 'Payment is temporarily unavailable' }, { status: 500 })
  }

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount: Math.round(price * 100),
        currency: 'GHS',
        metadata: { orderId: order.id },
        callback_url: `${siteUrl}/dashboard/customer/orders/${order.id}`,
      }),
      signal: AbortSignal.timeout(10000),
    })

    const data = await response.json()
    if (!data?.status || typeof data?.data?.authorization_url !== 'string') {
      console.error('[payments] Paystack initialize failed:', data?.message)
      return NextResponse.json({ error: 'Could not start payment. Please try again.' }, { status: 502 })
    }

    return NextResponse.json({ authorizationUrl: data.data.authorization_url })
  } catch (e) {
    console.error('[payments] Paystack request error:', e)
    return NextResponse.json({ error: 'Could not reach the payment provider. Please try again.' }, { status: 502 })
  }
}