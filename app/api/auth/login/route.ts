import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isRateLimited, recordAttempt, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  const ip = getClientIp(req)

  if (!email || !password) {
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
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
        await recordAttempt(email.toLowerCase(), 'login', false)
        await recordAttempt(ip, 'login', false)
        return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 })
    }

    await recordAttempt(email.toLowerCase(), 'login', true)
    await recordAttempt(ip, 'login', true)

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