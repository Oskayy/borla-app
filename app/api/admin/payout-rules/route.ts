import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'FINANCE']

async function requireFinanceRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !ALLOWED_ROLES.includes(dbUser.role)) return null

  return dbUser
}

export async function GET() {
  const dbUser = await requireFinanceRole()
  if (!dbUser) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const rules = await prisma.payoutRule.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ rules })
}

export async function POST(req: NextRequest) {
  const dbUser = await requireFinanceRole()
  if (!dbUser) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { pickupPercent, disposalPercent } = await req.json()

  if (pickupPercent == null || disposalPercent == null || isNaN(pickupPercent) || isNaN(disposalPercent)) {
    return NextResponse.json({ error: 'Both percentages are required and must be numbers' }, { status: 400 })
  }

  if (Number(pickupPercent) + Number(disposalPercent) !== 100) {
    return NextResponse.json({ error: 'Pickup % and disposal % must add up to 100' }, { status: 400 })
  }

  const newRule = await prisma.$transaction(async (tx) => {
    await tx.payoutRule.updateMany({ where: { active: true }, data: { active: false } })
    return tx.payoutRule.create({
      data: {
        pickupPercent: Number(pickupPercent),
        disposalPercent: Number(disposalPercent),
        active: true,
      },
    })
  })

  return NextResponse.json({ success: true, rule: newRule })
}