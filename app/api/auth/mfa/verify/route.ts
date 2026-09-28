import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isRateLimited, recordAttempt } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please log in again' }, { status: 401 })

  if (await isRateLimited({ identifier: user.id, action: 'mfa_enroll', maxAttempts: 5, windowMinutes: 15, onlyFailures: true })) {
    return NextResponse.json({ error: 'Too many incorrect codes. Please wait 15 minutes and try again.' }, { status: 429 })
  }

  const body = await readJson(req)
  const factorId = typeof body?.factorId === 'string' ? body.factorId : ''
  const code = typeof body?.code === 'string' ? body.code.trim() : ''

  if (!factorId || factorId.length > 100 || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'Please enter the 6-digit code' }, { status: 400 })
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
  if (challengeError || !challenge) {
    return NextResponse.json({ error: 'Could not verify. Please try again.' }, { status: 400 })
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
  if (verifyError) {
    await recordAttempt(user.id, 'mfa_enroll', false)
    return NextResponse.json({ error: 'Incorrect code. Double check your authenticator app and try again.' }, { status: 401 })
  }

  await recordAttempt(user.id, 'mfa_enroll', true)
  return NextResponse.json({ success: true })
}