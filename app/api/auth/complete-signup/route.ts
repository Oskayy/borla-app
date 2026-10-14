import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { isRateLimited, recordAttempt, getClientIp } from '@/lib/rate-limit'
import { cleanText, readJson } from '@/lib/validate'
import { caught } from '@/lib/errors'

// Finishes an account started with Google (or another provider): the person is signed in with Supabase but has
// no Trashit profile yet. Only customer and driver accounts can be made here, as on the sign-up form.
const SELF_SERVICE_ROLES = ['CUSTOMER', 'DRIVER']
const PHONE_RE = /^\+?[0-9 ()-]{9,20}$/

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (await isRateLimited({ identifier: ip, action: 'signup', maxAttempts: 10, windowMinutes: 60 })) {
    return NextResponse.json({ error: 'Too many sign-up attempts from this device. Please try again later.' }, { status: 429 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in first' }, { status: 401 })
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
    return NextResponse.json({ error: 'Two-factor verification required' }, { status: 401 })
  }
  if (!user.email) return NextResponse.json({ error: 'That account has no email address. Please sign up with your email.' }, { status: 400 })

  if (await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } })) {
    return NextResponse.json({ error: 'Your account is already set up.' }, { status: 409 })
  }

  const body = await readJson(req)
  const name = cleanText(body?.name, 100)
  const phone = cleanText(body?.phone, 20)
  const role = body?.role
  if (!name || !phone || !SELF_SERVICE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }
  // Minimum age (privacy policy section 9): 16 for customers (16-17 with a parent's or guardian's permission), 18 for drivers.
  if (body?.ageConfirmed !== true) {
    return NextResponse.json(
      { error: role === 'DRIVER' ? 'You must be 18 or older to drive with Trashit.' : 'Please confirm your age to create an account.' },
      { status: 400 }
    )
  }
  if (!PHONE_RE.test(phone)) return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 })

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.create({ data: { id: user.id, name, phone, email: user.email!.toLowerCase(), role: role as 'CUSTOMER' | 'DRIVER' } })
      if (role === 'DRIVER') await tx.driverProfile.create({ data: { userId: user.id } })
    })
  } catch (err) {
    const e = caught(err)
    await recordAttempt(ip, 'signup', false)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'That phone number or email is already registered. Sign in with your email and password instead.' }, { status: 400 })
    }
    console.error('[complete-signup] failed:', e)
    return NextResponse.json({ error: 'We could not finish creating your account. Please try again.' }, { status: 500 })
  }

  await recordAttempt(ip, 'signup', true)
  return NextResponse.json({ success: true })
}
