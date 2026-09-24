import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'


export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { orderId } = await req.json()

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.customerId !== user.id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const quote = order.quoteSnapshot as { price: number }
  const amountInPesewas = Math.round(quote.price * 100) // Paystack uses the smallest currency unit

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      amount: amountInPesewas,
      currency: 'GHS',
      metadata: { orderId: order.id },
      callback_url: `http://localhost:3000/dashboard/customer/orders/${order.id}`,
    }),
  })

  const data = await response.json()

  if (!data.status) {
    return NextResponse.json({ error: data.message }, { status: 500 })
  }

  return NextResponse.json({ authorizationUrl: data.data.authorization_url })
}