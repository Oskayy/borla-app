import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { prisma } from '@/lib/prisma'
import { validatePasswordStrength, isPasswordBreached } from '@/lib/password'
import { isRateLimited, recordAttempt, getClientIp } from '@/lib/rate-limit'
import { cleanText, readJson } from '@/lib/validate'
import { siteUrl } from '@/lib/site-url'
import { caught } from '@/lib/errors'
import { friendlyAuthError } from '@/lib/friendly-errors'

// Only these two roles can ever be created from the public signup form.
const SELF_SERVICE_ROLES = ['CUSTOMER', 'DRIVER']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9 ()-]{9,20}$/

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  if (await isRateLimited({ identifier: ip, action: 'signup', maxAttempts: 10, windowMinutes: 60 })) {
    return NextResponse.json({ error: 'Too many signup attempts from this device. Please try again later.' }, { status: 429 })
  }

  const body = await readJson(req)
  const name = cleanText(body?.name, 100)
  const phone = cleanText(body?.phone, 20)
  const email = cleanText(body?.email, 254)?.toLowerCase()
  const password = typeof body?.password === 'string' ? body.password : ''
  const role = body?.role

  if (!name || !phone || !email || !password || !SELF_SERVICE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }
  // Minimum age (privacy policy section 9): 16 for customers (16-17 with a parent's or guardian's permission), 18 for drivers.
  if (body?.ageConfirmed !== true) {
    return NextResponse.json(
      { error: role === 'DRIVER' ? 'You must be 18 or older to drive with Trashit.' : 'Please confirm your age to create an account.' },
      { status: 400 }
    )
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
  }
  if (!PHONE_RE.test(phone)) {
    return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 })
  }
  if (password.length > 128) {
    return NextResponse.json({ error: 'Password is too long' }, { status: 400 })
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
  // With "Confirm email" on in Supabase, this sends a confirmation email whose link comes back to /auth/confirm.
  const { data, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl(req)}/auth/confirm?next=${encodeURIComponent('/dashboard')}` },
  })

  if (authError || !data.user) {
    await recordAttempt(ip, 'signup', false)
    return NextResponse.json({ error: friendlyAuthError(authError, 'We could not create your account. Please try again.') }, { status: 400 })
  }

  // With email confirmation on, Supabase answers a sign-up for an email that already has an account with a
  // placeholder user (no identities) and sends no email. Answer exactly as for a new sign-up, so this form
  // can't be used to find out who has an account.
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    await recordAttempt(ip, 'signup', false)
    return NextResponse.json({ success: true, confirmEmail: true })
  }

  try {
    await prisma.user.create({
      data: { id: data.user.id, name, phone, email, role: role as 'CUSTOMER' | 'DRIVER' },
    })

    if (role === 'DRIVER') {
      await prisma.driverProfile.create({ data: { userId: data.user.id } })
    }
  } catch (err) {
    const e = caught(err)
    console.error('[signup] profile creation failed:', e)

    // Remove the half-created login so the person can simply try again.
    try {
      await createAdminClient().auth.admin.deleteUser(data.user.id)
    } catch (cleanupError) {
      console.error('[signup] cleanup failed:', cleanupError)
    }

    await recordAttempt(ip, 'signup', false)
    const message =
      e?.code === 'P2002'
        ? 'That phone number or email is already registered.'
        : 'We could not finish creating your account. Please try again.'
    return NextResponse.json({ error: message }, { status: e?.code === 'P2002' ? 400 : 500 })
  }

  await recordAttempt(ip, 'signup', true)
  // No session yet means Supabase is waiting for the email to be confirmed.
  return NextResponse.json({ success: true, confirmEmail: !data.session })
}