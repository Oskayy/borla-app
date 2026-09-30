import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isRateLimited, recordAttempt, getClientIp } from '@/lib/rate-limit'
import { siteUrl } from '@/lib/site-url'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  const ip = getClientIp(req)

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const blocked = await isRateLimited({
    identifier: email.toLowerCase(),
    action: 'password_reset',
    maxAttempts: 3,
    windowMinutes: 60,
  })

  // Always respond the same way whether blocked, whether the email
  // exists, or whether it succeeds — this stops the endpoint being used
  // to check which emails have accounts.
  if (!blocked) {
    await recordAttempt(email.toLowerCase(), 'password_reset', true)
    await recordAttempt(ip, 'password_reset', true)

    const supabase = await createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl(req)}/auth/confirm?next=/reset-password`,
    })
  }

  return NextResponse.json({ success: true })
}