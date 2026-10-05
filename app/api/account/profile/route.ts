import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, readJson } from '@/lib/validate'
import { localGhanaPhone, normalizeGhanaPhone } from '@/lib/phone'
import { logAdminAction } from '@/lib/admin-log'
import { caught } from '@/lib/errors'

// A customer updates their own name and phone number. Email changes go through support for now.
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(['CUSTOMER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'profile_update', maxAttempts: 10, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const name = cleanText(body?.name, 100)
  const normalized = normalizeGhanaPhone(body?.phone)
  if (!name || name.length < 2) return NextResponse.json({ error: 'Please enter your full name' }, { status: 400 })
  if (!normalized) return NextResponse.json({ error: 'Please enter a Ghana mobile number, e.g. 024 412 3456' }, { status: 400 })
  const phone = localGhanaPhone(normalized)

  const before = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { name: true, phone: true } })
  if (!before) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  if (before.name === name && before.phone === phone) return NextResponse.json({ success: true })

  try {
    await prisma.user.update({ where: { id: auth.user.id }, data: { name, phone } })
  } catch (err) {
    if (caught(err)?.code === 'P2002') {
      return NextResponse.json({ error: 'That phone number is already used by another account' }, { status: 409 })
    }
    console.error('[profile] update failed', err)
    return NextResponse.json({ error: 'Could not save your details. Please try again.' }, { status: 500 })
  }

  if (before.phone !== phone) {
    const mask = (p: string) => `${p.slice(0, 3)}****${p.slice(-3)}`
    await logAdminAction(auth.user.id, 'PROFILE_PHONE_CHANGED', auth.user.id, `${mask(before.phone)} -> ${mask(phone)}`)
  }
  return NextResponse.json({ success: true })
}
