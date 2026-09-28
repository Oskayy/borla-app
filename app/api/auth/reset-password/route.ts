import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { validatePasswordStrength, isPasswordBreached } from '@/lib/password'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Your reset link has expired. Please request a new one.' }, { status: 401 })
  }

  if (await enforceRateLimit({ identifier: user.id, action: 'reset_password', maxAttempts: 5, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const password = typeof body?.password === 'string' ? body.password : ''

  if (password.length > 128) {
    return NextResponse.json({ error: 'Password is too long' }, { status: 400 })
  }

  const strength = validatePasswordStrength(password)
  if (!strength.valid) {
    return NextResponse.json({ error: strength.message }, { status: 400 })
  }

  if (await isPasswordBreached(password)) {
    return NextResponse.json(
      { error: 'This password has appeared in a known data breach. Please choose a different password.' },
      { status: 400 }
    )
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Sign out every other device that might be using the old password.
  await supabase.auth.signOut({ scope: 'others' })

  return NextResponse.json({ success: true })
}