import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['SUPER_ADMIN'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'mfa_recovery', maxAttempts: 5, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const email = cleanText(body?.targetEmail, 254)?.toLowerCase()
  if (!email) return NextResponse.json({ error: 'Target email is required' }, { status: 400 })

  const target = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  })
  if (!target) return NextResponse.json({ error: 'No user found with that email' }, { status: 404 })

  if (target.id === auth.user.id) {
    return NextResponse.json({ error: 'Use your own account security page to change your 2FA' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: factorsData, error: listError } = await admin.auth.admin.mfa.listFactors({ userId: target.id })
  if (listError) {
    console.error('[mfa-recovery] list failed:', listError)
    return NextResponse.json({ error: 'Could not look up that user’s 2FA' }, { status: 400 })
  }

  const factors = factorsData?.factors ?? []
  if (factors.length === 0) {
    return NextResponse.json({ error: 'This user has no 2FA factors enrolled' }, { status: 400 })
  }

  for (const factor of factors) {
    await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: target.id })
  }

  await logAdminAction(auth.user.id, 'MFA_RESET', target.id, `Reset 2FA for ${target.email} (${target.role})`)

  return NextResponse.json({ success: true, factorsRemoved: factors.length })
}