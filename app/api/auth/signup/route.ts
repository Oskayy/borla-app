import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { validatePasswordStrength, isPasswordBreached } from '@/lib/password'
import { isRateLimited, recordAttempt, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  if (await isRateLimited({ identifier: ip, action: 'signup', maxAttempts: 10, windowMinutes: 60 })) {
    return NextResponse.json({ error: 'Too many signup attempts from this device. Please try again later.' }, { status: 429 })
  }

  const { name, phone, email, password, role } = await req.json()

  if (!name || !phone || !email || !password || !role) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  const strength = validatePasswordStrength(password)
  if (!strength.valid) {
    await recordAttempt(ip, 'signup', false)
    return NextResponse.json({ error: strength.message }, { status: 400 })
  }

  if (await isPasswordBreached(password)) {
    await recordAttempt(ip, 'signup', false)
    return NextResponse.json(
      { error: 'This password has appeared in a known data breach. Please choose a different password.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data, error: authError } = await supabase.auth.signUp({ email, password })

  if (authError) {
    await recordAttempt(ip, 'signup', false)
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  try {
    await prisma.user.create({
      data: { id: data.user!.id, name, phone, email, role },
    })
  } catch (e) {
    await recordAttempt(ip, 'signup', false)
    return NextResponse.json({ error: 'Account created, but profile setup failed. Contact support.' }, { status: 500 })
  }

  await recordAttempt(ip, 'signup', true)
  return NextResponse.json({ success: true })
}