import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'


export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { address, wasteType, bagCount, price, ruleId } = await req.json()

  const order = await prisma.order.create({
    data: {
      customerId: user.id,
      status: 'DRAFT',
      quoteSnapshot: { address, wasteType, bagCount, price, ruleId },
    },
  })

  return NextResponse.json(order)
}