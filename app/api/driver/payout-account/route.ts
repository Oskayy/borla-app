import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, readJson } from '@/lib/validate'
import { isMomoProvider, localGhanaPhone, normalizeGhanaPhone } from '@/lib/phone'
import { logAdminAction } from '@/lib/admin-log'

// The mobile money wallet a driver's earnings are sent to.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'payout_account', maxAttempts: 10, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const number = normalizeGhanaPhone(body?.momoNumber)
  const provider = body?.momoProvider
  const name = cleanText(body?.momoName, 100)
  if (!number) return NextResponse.json({ error: 'Please enter a valid Ghana mobile number, e.g. 024 412 3456' }, { status: 400 })
  if (!isMomoProvider(provider)) return NextResponse.json({ error: 'Please choose your mobile money network' }, { status: 400 })
  if (!name || name.length < 3) return NextResponse.json({ error: 'Please enter the name on the wallet' }, { status: 400 })

  // Changing the wallet isn't allowed while a withdrawal is on its way, so money can't be redirected mid-payment.
  const open = await prisma.withdrawal.count({ where: { driverId: auth.user.id, status: { in: ['REQUESTED', 'PROCESSING'] } } })
  if (open > 0) {
    return NextResponse.json({ error: 'You have a withdrawal in progress. You can change your wallet once it is finished.' }, { status: 409 })
  }

  const local = localGhanaPhone(number)
  await prisma.driverProfile.update({
    where: { userId: auth.user.id },
    data: { momoNumber: local, momoProvider: provider, momoName: name },
  })
  await logAdminAction(auth.user.id, 'DRIVER_PAYOUT_ACCOUNT_SET', auth.user.id, `${provider} ${local.slice(0, 3)}****${local.slice(-3)}`)
  return NextResponse.json({ success: true })
}
