import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isRateLimited, recordAttempt, getClientIp } from '@/lib/rate-limit'
import { cleanText, readJson } from '@/lib/validate'
import { siteUrl } from '@/lib/site-url'

// Sends the "confirm your email" link again. Always answers the same way, so it can't be used to find accounts.
export async function POST(req: NextRequest) {
  const email = cleanText((await readJson(req))?.email, 254)?.toLowerCase()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const ip = getClientIp(req)
  const blocked =
    (await isRateLimited({ identifier: email, action: 'resend_confirmation', maxAttempts: 3, windowMinutes: 60 })) ||
    (await isRateLimited({ identifier: ip, action: 'resend_confirmation', maxAttempts: 10, windowMinutes: 60 }))

  if (!blocked) {
    await recordAttempt(email, 'resend_confirmation', true)
    await recordAttempt(ip, 'resend_confirmation', true)
    const supabase = await createClient()
    await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${siteUrl(req)}/auth/confirm?next=${encodeURIComponent('/dashboard')}` },
    })
  }

  return NextResponse.json({ success: true })
}
