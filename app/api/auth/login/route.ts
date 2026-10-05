import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isRateLimited, recordAttempt, getClientIp } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const body = await readJson(req)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const ip = getClientIp(req)

  if (!email || !password || email.length > 254 || password.length > 128) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const emailBlocked = await isRateLimited({
    identifier: email.toLowerCase(),
    action: 'login',
    maxAttempts: 5,
    windowMinutes: 15,
    onlyFailures: true,
  })

  const ipBlocked = await isRateLimited({
    identifier: ip,
    action: 'login',
    maxAttempts: 20,
    windowMinutes: 15,
    onlyFailures: true,
  })

  if (emailBlocked || ipBlocked) {
    return NextResponse.json(
      { error: 'Too many failed login attempts. Please wait 15 minutes and try again.' },
      { status: 429 }
    )
  }

    const supabase = await createClient()
    const { data: signedIn, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError?.code === 'email_not_confirmed') {
        // Right password, but the email address hasn't been confirmed yet.
        return NextResponse.json(
          { error: 'Please confirm your email address first. Check your inbox (and spam) for the link from Trashit.', notConfirmed: true },
          { status: 403 }
        )
    }

    if (authError) {
        await recordAttempt(email.toLowerCase(), 'login', false)
        await recordAttempt(ip, 'login', false)
        return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 })
    }

    await recordAttempt(email.toLowerCase(), 'login', true)
    await recordAttempt(ip, 'login', true)

    // Suspended staff and deleted customer accounts can't sign in, even if the login itself still exists.
    const account = signedIn.user ? await prisma.user.findUnique({ where: { id: signedIn.user.id }, select: { active: true } }) : null
    if (!account || !account.active) {
        await supabase.auth.signOut({ scope: 'local' })
        return NextResponse.json({ error: 'This account is closed. Contact Trashit if you think this is a mistake.' }, { status: 403 })
    }

  // Password was correct. Check whether this account has 2FA enabled —
  // if so, the session is only at aal1 (password-only) and needs a
  // second step before it's fully authenticated.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        const { data: factorsData } = await supabase.auth.mfa.listFactors()
        const totpFactor = factorsData?.totp?.[0]

        return NextResponse.json({
            success: true,
            mfaRequired: true,
            factorId: totpFactor?.id,
        })
    }

    return NextResponse.json({ success: true, mfaRequired: false })
}