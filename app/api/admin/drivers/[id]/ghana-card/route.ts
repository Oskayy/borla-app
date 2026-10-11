import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { APPROVAL_ROLES } from '@/lib/driver-docs'
import { maskGhanaCard, parseGhanaCard } from '@/lib/ghana-card'
import { caught } from '@/lib/errors'

// The staff who approve drivers enter or correct a driver's Ghana Card number (e.g. for drivers approved before
// the number was asked for, copied from the card photo they uploaded then). A correction needs a reason; every
// change is logged.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(APPROVAL_ROLES)
  if (!auth.ok) return auth.response
  if (await enforceRateLimit({ identifier: auth.user.id, action: 'ghana_card_edit', maxAttempts: 30, windowMinutes: 60 })) return tooManyRequests()

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
  const body = await readJson(req)
  const number = parseGhanaCard(body?.number)
  if (!number) return NextResponse.json({ error: 'Please enter a Ghana Card number, e.g. GHA-123456789-0' }, { status: 400 })
  const reason = cleanText(body?.reason, 200)

  const profile = await prisma.driverProfile.findFirst({ where: { userId: id, user: { role: 'DRIVER' } }, select: { ghanaCardNumber: true } })
  if (!profile) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
  if (profile.ghanaCardNumber === number) return NextResponse.json({ success: true, number: maskGhanaCard(number) })
  if (profile.ghanaCardNumber && (!reason || reason.length < 3)) {
    return NextResponse.json({ error: 'This driver already has a number. Please say why you are correcting it.' }, { status: 400 })
  }

  try {
    await prisma.driverProfile.update({ where: { userId: id }, data: { ghanaCardNumber: number } })
  } catch (err) {
    if (caught(err)?.code === 'P2002') {
      return NextResponse.json({ error: 'That Ghana Card number is already on another driver account.' }, { status: 409 })
    }
    throw err
  }
  await logAdminAction(
    auth.user.id,
    profile.ghanaCardNumber ? 'GHANA_CARD_CORRECTED' : 'GHANA_CARD_ENTERED',
    id,
    profile.ghanaCardNumber ? `${maskGhanaCard(profile.ghanaCardNumber)} -> ${maskGhanaCard(number)}: ${reason}` : `Entered ${maskGhanaCard(number)}`
  )
  return NextResponse.json({ success: true, number: maskGhanaCard(number) })
}
