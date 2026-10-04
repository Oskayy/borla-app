import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isRateLimited, recordAttempt, getClientIp } from '@/lib/rate-limit'
import { siteUrl } from '@/lib/site-url'
import { cleanText, readJson } from '@/lib/validate'

export async function POST(req: NextRequest) {
  const email = cleanText((await readJson(req))?.email, 254)?.toLowerCase()
  const ip = getClientIp(req)

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const blocked =
    (await isRateLimited({ identifier: email, action: 'password_reset', maxAttempts: 3, windowMinutes: 60 })) ||
    (await isRateLimited({ identifier: ip, action: 'password_reset', maxAttempts: 10, windowMinutes: 60 }))

  // Always respond the same way whether blocked, whether the email
  // exists, or whether it succeeds — this stops the endpoint being used
  // to check which emails have accounts.
  if (!blocked) {
    await recordAttempt(email, 'password_reset', true)
    await recordAttempt(ip, 'password_reset', true)

    const supabase = await createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl(req)}/auth/confirm?next=/reset-password`,
    })
  }

  return NextResponse.json({ success: true })
}