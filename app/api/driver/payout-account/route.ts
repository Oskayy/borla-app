import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, readJson } from '@/lib/validate'
import { isMomoProvider, localGhanaPhone, normalizeGhanaPhone } from '@/lib/phone'
import { logAdminAction } from '@/lib/admin-log'
import { confirmPassword } from '@/lib/reauth'
import { notifyUser } from '@/lib/notify'
import { sendSms } from '@/lib/sms'
import { OPEN_WITHDRAWAL_STATUSES, PAYOUT_CHANGE_HOLD_HOURS } from '@/lib/wallet'

// The mobile money wallet a driver's earnings are sent to.
// Replacing a wallet needs the password again, starts a 24-hour hold on withdrawals, and alerts the driver
// (and the old number by SMS), so a stolen phone can't quietly redirect their earnings.
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
  const open = await prisma.withdrawal.count({ where: { driverId: auth.user.id, status: { in: OPEN_WITHDRAWAL_STATUSES } } })
  if (open > 0) {
    return NextResponse.json({ error: 'You have a withdrawal in progress. You can change your wallet once it is finished.' }, { status: 409 })
  }

  const passwordProblem = await confirmPassword(auth.user.id, auth.user.email, body?.password)
  if (passwordProblem) return NextResponse.json({ error: passwordProblem }, { status: 403 })

  const local = localGhanaPhone(number)
  const before = await prisma.driverProfile.findUnique({
    where: { userId: auth.user.id },
    select: { momoNumber: true, momoProvider: true, momoName: true },
  })
  const unchanged = before?.momoNumber === local && before?.momoProvider === provider && before?.momoName === name
  if (unchanged) return NextResponse.json({ success: true, holdHours: 0 })
  // Only replacing an existing wallet starts the hold; a driver's first wallet can be used straight away.
  const replacing = !!before?.momoNumber

  await prisma.driverProfile.update({
    where: { userId: auth.user.id },
    data: { momoNumber: local, momoProvider: provider, momoName: name, ...(replacing ? { momoChangedAt: new Date() } : {}) },
  })
  const masked = (n: string) => `${n.slice(0, 3)}****${n.slice(-3)}`
  await logAdminAction(
    auth.user.id,
    'DRIVER_PAYOUT_ACCOUNT_SET',
    auth.user.id,
    replacing ? `${before!.momoProvider} ${masked(before!.momoNumber!)} -> ${provider} ${masked(local)}` : `${provider} ${masked(local)}`
  )

  if (replacing) {
    const text = `Your Trashit payout wallet was changed to ${provider} ${masked(local)}. Withdrawals are paused for ${PAYOUT_CHANGE_HOLD_HOURS} hours. If this wasn't you, contact Trashit now.`
    await notifyUser(auth.user.id, { title: 'Payout wallet changed', body: text, url: '/dashboard/driver/earnings', sms: `Trashit: ${text}` })
    // The old wallet's owner hears about it too, in case the account phone is the one that was taken.
    if (before!.momoNumber !== local) await sendSms(before!.momoNumber, `Trashit: ${text}`)
  }
  return NextResponse.json({ success: true, holdHours: replacing ? PAYOUT_CHANGE_HOLD_HOURS : 0 })
}
