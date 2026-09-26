import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || dbUser.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { targetEmail } = await req.json()
  if (!targetEmail) {
    return NextResponse.json({ error: 'Target email is required' }, { status: 400 })
  }

  const targetUser = await prisma.user.findUnique({ where: { email: targetEmail } })
  if (!targetUser) {
    return NextResponse.json({ error: 'No user found with that email' }, { status: 404 })
  }

  const admin = createAdminClient()

  const { data: factorsData, error: listError } = await admin.auth.admin.mfa.listFactors({
    userId: targetUser.id,
  })

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 400 })
  }

  const factors = factorsData?.factors ?? []
  if (factors.length === 0) {
    return NextResponse.json({ error: 'This user has no 2FA factors enrolled' }, { status: 400 })
  }

  for (const factor of factors) {
    await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: targetUser.id })
  }

  await prisma.auditLog.create({
    data: {
      orderId: null,
      actorId: user.id,
      fromState: 'MFA_ENABLED',
      toState: 'MFA_RESET',
      reason: `Admin ${dbUser.name} reset 2FA for ${targetUser.name} (${targetEmail}) — recovery request`,
    },
  })

  return NextResponse.json({ success: true, factorsRemoved: factors.length })
}